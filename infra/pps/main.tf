# =============================================================================
# 가상조달기관 레거시 + 이음 — KT Cloud 공공존(G-Cloud) 구조를 Azure 로 재현한 시연 환경
#
# 모듈 조합(재사용 단위는 modules/ 아래 다섯 개):
#   network    VNet · 서브넷 4 · NSG 2          KT DMZ/Private Tier · 기관 업무망 · Private Tier DB · 외부연동 F/W
#   legacy-vm  레거시 서버(공인 IP 없음)          기관 전산실의 레거시 WAS
#   legacy-db  PostgreSQL Flexible(사설)          Private Tier DB
#   vault      Key Vault(사설 엔드포인트)          비밀 보관
#   ieum-app   이음 Container App(허용 대역만)     공공존 서비스 계층
#   github-oidc GitHub Actions 로그인(OIDC)         dev 머지 → 이 환경 자동 배포(.github/workflows/deploy-aca.yml)
# 다른 기관 · 다른 환경은 terraform.tfvars 만 바꿔 같은 모듈로 올린다(README '재사용').
#
# 재현하지 못하는 것: CSAP 인증 자체, 공공 전용 물리 상면, 국내 CC 인증 H/W 장비, 국가정보통신망 직결.
# 이 스택은 리소스 그룹 · ACR 을 만들지 않는다(기존 것을 참조만 한다).
# =============================================================================

data "azurerm_client_config" "me" {}

data "azurerm_resource_group" "main" {
  name = var.resource_group_name
}

locals {
  p         = var.name_prefix
  rg        = data.azurerm_resource_group.main.name
  location  = var.location
  tags      = merge({ project = "ieum-pps", env = var.environment, persona = "kt-cloud-public-zone", purpose = "demo-virtual-system" }, var.extra_tags)
  legacy_ip = cidrhost(var.subnets.legacy, 10) # 10.70.1.10 — 레거시 4종이 이 한 대에 뜬다
  reader    = "pps_reader"                     # 이음이 쓰는 읽기 전용 DB 계정(deploy_legacy.sh 가 만든다)
}

module "network" {
  source              = "./modules/network"
  prefix              = local.p
  resource_group_name = local.rg
  location            = local.location
  tags                = local.tags
  address_space       = var.address_space
  subnets             = var.subnets
  legacy_ports        = var.legacy_ports
  internet_lockdown   = var.internet_lockdown
}

module "legacy_vm" {
  source               = "./modules/legacy-vm"
  name                 = "${local.p}-legacy"
  resource_group_name  = local.rg
  location             = local.location
  tags                 = local.tags
  subnet_id            = module.network.subnet_ids.legacy
  private_ip           = local.legacy_ip
  size                 = var.vm_size
  admin_ssh_public_key = var.admin_ssh_public_key
  auto_shutdown_time   = var.vm_auto_shutdown_time
}

module "legacy_db" {
  source              = "./modules/legacy-db"
  name                = "${local.p}-legacy"
  resource_group_name = local.rg
  location            = local.location
  tags                = local.tags
  vnet_id             = module.network.vnet_id
  subnet_id           = module.network.subnet_ids.db
  databases           = ["pps_legacy"]
  sku                 = var.pg_sku
}

resource "random_password" "reader" {
  length  = 24
  special = false
}

resource "random_password" "ieum_secret" {
  length  = 44
  special = false
}

module "vault" {
  source              = "./modules/vault"
  prefix              = local.p
  resource_group_name = local.rg
  location            = local.location
  tags                = local.tags
  vnet_id             = module.network.vnet_id
  pe_subnet_id        = module.network.subnet_ids.pe
  public_during_apply = var.kv_public_during_apply
  secrets = {
    "pps-legacy-pg-password"        = module.legacy_db.admin_password
    "pps-legacy-pg-reader-password" = random_password.reader.result
  }
}

module "ieum" {
  source                  = "./modules/ieum-app"
  prefix                  = local.p
  resource_group_name     = local.rg
  location                = local.location
  tags                    = local.tags
  subnet_id               = module.network.subnet_ids.app
  acr_name                = var.container_registry_name
  acr_resource_group_name = local.rg
  image                   = var.container_image
  allowed_cidrs           = var.allowed_cidrs
  env = {
    IEUM_PROBE_CIDRS      = var.address_space # 서버발 요청은 이 VNet 안만
    IEUM_DEMO_LEGACY_HOST = local.legacy_ip
    IEUM_DEMO_DB_HOST     = module.legacy_db.fqdn
    IEUM_DEMO_DB_PORT     = "5432"
    IEUM_DEMO_DB_USER     = local.reader
  }
  secret_env = {
    IEUM_SECRET_KEY       = random_password.ieum_secret.result
    IEUM_DEMO_DB_PASSWORD = random_password.reader.result
    # 온보딩 위자드의 클라우드 DB · 직접 입력 DB 시연 값
    PPS_LEGACY_DSN = "postgresql://${local.reader}:${random_password.reader.result}@${module.legacy_db.fqdn}:5432/pps_legacy"
  }
}

# ── CI/CD — dev 머지마다 이 환경(staging)으로 자동 배포 ──────────────────────
# 워크플로는 러너에서 이미지를 빌드해 공유 ACR 에 올리고(AcrPush), 이 앱의 이미지만 바꾼다(앱 단위 Contributor).
# 공유 ACR 과 RG 의 다른 리소스(다른 서비스의 앱 · VM)는 바꿀 수 없다.
module "cicd" {
  source         = "./modules/github-oidc"
  display_name   = "gh-${replace(var.github_repo, "/", "-")}-${local.p}-${var.environment}"
  github_repo    = var.github_repo
  subject_prefix = var.github_oidc_subject_prefix
  branches       = var.deploy_branches
  role_assignments = {
    acr_push  = { scope = module.ieum.acr_id, role = "AcrPush" }
    acr_read  = { scope = module.ieum.acr_id, role = "Reader" } # az acr login 이 레지스트리 정보를 읽는다
    app_write = { scope = module.ieum.id, role = "Contributor" }
    env_read  = { scope = module.ieum.environment_id, role = "Reader" }
  }
}
