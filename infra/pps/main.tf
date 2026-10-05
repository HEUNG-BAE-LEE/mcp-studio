# =============================================================================
# 가상조달기관 레거시 + 이음 — KT Cloud 공공존(G-Cloud) 구조를 Azure 로 재현한 시연 환경
#
# 무엇을 흉내 내는가 (KT G-Cloud 공개 매뉴얼·보안백서 기준, README.md 대응표 참고)
#   KT DMZ Tier / Private Tier        → snet-aca (이음: 콘솔·MCP — 외부 노출은 IP 제한으로 DMZ F/W 모사)
#   기관 전산실 ↔ 전용회선 ↔ 외부연동 F/W → snet-legacy + nsg-legacy (이음 서브넷에서 레거시 포트만 허용)
#   Private Tier DB                     → snet-pg (위임 서브넷, 공개 접근 차단)
#   보안 매니지드 F/W 3종               → ACA ingress IP 제한(DMZ) · nsg-legacy(외부연동) · nsg-pg(Private)
#   반입 후 밀봉                         → internet_lockdown (2단계 apply)
# 재현하지 못하는 것: CSAP 인증 자체, 공공 전용 물리 상면, 국내 CC 인증 H/W 장비, 국가정보통신망 직결.
#
# 이 스택은 리소스 그룹·ACR 을 만들지 않는다(기존 것을 쓴다). 다른 서비스 리소스와 이름이 겹치지 않게 prefix 를 쓴다.
# =============================================================================

data "azurerm_resource_group" "main" {
  name = var.resource_group_name
}

data "azurerm_container_registry" "acr" {
  name                = var.container_registry_name
  resource_group_name = var.resource_group_name
}

data "azurerm_client_config" "me" {}

locals {
  p        = var.name_prefix
  location = var.location
  tags     = { project = "ieum-pps", persona = "kt-cloud-public-zone", purpose = "demo-virtual-system" }
}

resource "random_string" "suffix" {
  length  = 5
  upper   = false
  special = false
}

# ── 네트워크 ──────────────────────────────────────────────────────────────
resource "azurerm_virtual_network" "main" {
  name                = "vnet-${local.p}"
  resource_group_name = data.azurerm_resource_group.main.name
  location            = local.location
  address_space       = [var.address_space]
  tags                = local.tags
}

resource "azurerm_subnet" "aca" {
  name                 = "snet-${local.p}-aca" # KT DMZ/Private Tier 모사 — 이음
  resource_group_name  = data.azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.subnet_aca]
  delegation {
    name = "aca"
    service_delegation {
      name    = "Microsoft.App/environments"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "legacy" {
  name                 = "snet-${local.p}-legacy" # 기관 업무망 모사 — 레거시 VM
  resource_group_name  = data.azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.subnet_legacy]
  # 새 VNet 의 기본 아웃바운드는 꺼지는 쪽으로 바뀌었다. 반입(apt·pip) 단계에만 쓰고, 밀봉은 NSG 가 한다
  default_outbound_access_enabled = true
}

resource "azurerm_subnet" "pg" {
  name                 = "snet-${local.p}-pg" # Private Tier DB 모사
  resource_group_name  = data.azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.subnet_pg]
  service_endpoints    = ["Microsoft.Storage"]
  delegation {
    name = "pgflex"
    service_delegation {
      name    = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "pe" {
  name                 = "snet-${local.p}-pe"
  resource_group_name  = data.azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.subnet_pe]
}

# 외부연동 F/W 모사 — 레거시는 이음 서브넷에서 오는 레거시 포트만 받는다. 그 밖의 인바운드는 전부 거부.
resource "azurerm_network_security_group" "legacy" {
  name                = "nsg-${local.p}-legacy"
  resource_group_name = data.azurerm_resource_group.main.name
  location            = local.location
  tags                = local.tags

  security_rule {
    name                       = "Allow-Ieum-To-Legacy"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefix      = var.subnet_aca
    source_port_range          = "*"
    destination_address_prefix = "*"
    destination_port_ranges    = ["8001-8004"]
  }
  security_rule {
    name                       = "Deny-All-Inbound"
    priority                   = 4000
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_address_prefix      = "*"
    source_port_range          = "*"
    destination_address_prefix = "*"
    destination_port_range     = "*"
  }
  security_rule {
    name                       = "Allow-To-Legacy-DB"
    priority                   = 100
    direction                  = "Outbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefix      = "*"
    source_port_range          = "*"
    destination_address_prefix = var.subnet_pg
    destination_port_range     = "5432"
  }
  dynamic "security_rule" {
    for_each = var.internet_lockdown ? [1] : []
    content {
      name                       = "Deny-Internet-Outbound" # 반입이 끝나면 밀봉한다
      priority                   = 4000
      direction                  = "Outbound"
      access                     = "Deny"
      protocol                   = "*"
      source_address_prefix      = "*"
      source_port_range          = "*"
      destination_address_prefix = "Internet"
      destination_port_range     = "*"
    }
  }
}

resource "azurerm_subnet_network_security_group_association" "legacy" {
  subnet_id                 = azurerm_subnet.legacy.id
  network_security_group_id = azurerm_network_security_group.legacy.id
}

resource "azurerm_network_security_group" "pg" {
  name                = "nsg-${local.p}-pg"
  resource_group_name = data.azurerm_resource_group.main.name
  location            = local.location
  tags                = local.tags

  security_rule {
    name                       = "Allow-App-And-Legacy-To-PG"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefixes    = [var.subnet_aca, var.subnet_legacy]
    source_port_range          = "*"
    destination_address_prefix = "*"
    destination_port_range     = "5432"
  }
  security_rule {
    name                       = "Deny-VNet-Other"
    priority                   = 4000
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_address_prefix      = "VirtualNetwork"
    source_port_range          = "*"
    destination_address_prefix = "*"
    destination_port_range     = "*"
  }
}

resource "azurerm_subnet_network_security_group_association" "pg" {
  subnet_id                 = azurerm_subnet.pg.id
  network_security_group_id = azurerm_network_security_group.pg.id
}

# ── 레거시 VM (기관 업무망) — 공인 IP 없음. 반입은 관리 채널(run-command)로만 ────────
resource "azurerm_network_interface" "legacy" {
  name                = "nic-${local.p}-legacy"
  resource_group_name = data.azurerm_resource_group.main.name
  location            = local.location
  tags                = local.tags
  ip_configuration {
    name                          = "ipcfg"
    subnet_id                     = azurerm_subnet.legacy.id
    private_ip_address_allocation = "Static"
    private_ip_address            = cidrhost(var.subnet_legacy, 10) # 10.70.1.10
  }
}

resource "azurerm_linux_virtual_machine" "legacy" {
  name                            = "vm-${local.p}-legacy"
  resource_group_name             = data.azurerm_resource_group.main.name
  location                        = local.location
  size                            = var.vm_size
  admin_username                  = var.admin_username
  disable_password_authentication = true
  network_interface_ids           = [azurerm_network_interface.legacy.id]
  tags                            = local.tags

  admin_ssh_key {
    username   = var.admin_username
    public_key = var.admin_ssh_public_key
  }
  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "StandardSSD_LRS"
  }
  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }
  # 외부 스크립트를 curl | sh 로 받지 않는다 — 배포판 패키지만 (폐쇄망 반입 취지)
  custom_data = base64encode(<<-EOT
    #cloud-config
    package_update: true
    packages: [python3-venv, python3-pip, postgresql-client]
    users:
      - default
      - name: legacy
        system: true
        shell: /usr/sbin/nologin
    runcmd:
      - mkdir -p /opt/legacy-pps && chown legacy:legacy /opt/legacy-pps
  EOT
  )
  lifecycle {
    ignore_changes = [custom_data] # custom_data 는 생성 시 1회만 — 바꾸면 VM 이 다시 만들어진다
  }
}

resource "azurerm_dev_test_global_vm_shutdown_schedule" "legacy" {
  virtual_machine_id    = azurerm_linux_virtual_machine.legacy.id
  location              = local.location
  enabled               = true
  daily_recurrence_time = "2200"
  timezone              = "Korea Standard Time"
  notification_settings { enabled = false }
}

# ── 레거시 DB (Private Tier) ──────────────────────────────────────────────
resource "random_password" "pg" {
  length  = 24
  special = false
}

resource "azurerm_private_dns_zone" "pg" {
  name                = "${local.p}-legacy.private.postgres.database.azure.com"
  resource_group_name = data.azurerm_resource_group.main.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "pg" {
  name                  = "pg-link"
  resource_group_name   = data.azurerm_resource_group.main.name
  private_dns_zone_name = azurerm_private_dns_zone.pg.name
  virtual_network_id    = azurerm_virtual_network.main.id
}

resource "azurerm_postgresql_flexible_server" "legacy" {
  name                          = "pg-${local.p}-legacy-${random_string.suffix.result}"
  resource_group_name           = data.azurerm_resource_group.main.name
  location                      = local.location
  version                       = "16"
  sku_name                      = var.pg_sku
  storage_mb                    = 32768
  administrator_login           = "ppsadmin"
  administrator_password        = random_password.pg.result
  delegated_subnet_id           = azurerm_subnet.pg.id
  private_dns_zone_id           = azurerm_private_dns_zone.pg.id
  public_network_access_enabled = false
  tags                          = local.tags
  depends_on                    = [azurerm_private_dns_zone_virtual_network_link.pg]
}

resource "azurerm_postgresql_flexible_server_database" "pps" {
  name      = "pps_legacy"
  server_id = azurerm_postgresql_flexible_server.legacy.id
  charset   = "UTF8"
  collation = "ko_KR.utf8"
}

# ── 비밀 금고 — 사설 엔드포인트로만 ─────────────────────────────────────────
resource "azurerm_key_vault" "main" {
  name                          = "kv-${local.p}-${random_string.suffix.result}"
  resource_group_name           = data.azurerm_resource_group.main.name
  location                      = local.location
  tenant_id                     = data.azurerm_client_config.me.tenant_id
  sku_name                      = "standard"
  rbac_authorization_enabled    = true
  purge_protection_enabled      = false
  soft_delete_retention_days    = 7
  public_network_access_enabled = var.kv_public_during_apply # apply 중 비밀값을 넣으려면 잠시 열어야 한다
  tags                          = local.tags
}

resource "azurerm_role_assignment" "kv_me" {
  scope                = azurerm_key_vault.main.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.me.object_id
}

resource "random_password" "ieum_secret" {
  length  = 44
  special = false
}

# 이음이 쓰는 DB 계정은 읽기 전용 역할이다(deploy_legacy.sh 가 만든다). 관리자 계정은 이음에 주지 않는다
resource "random_password" "pg_reader" {
  length  = 24
  special = false
}

resource "azurerm_key_vault_secret" "pg_reader" {
  name         = "pps-legacy-pg-reader-password"
  value        = random_password.pg_reader.result
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_role_assignment.kv_me]
}

resource "azurerm_key_vault_secret" "pg" {
  name         = "pps-legacy-pg-password"
  value        = random_password.pg.result
  key_vault_id = azurerm_key_vault.main.id
  depends_on   = [azurerm_role_assignment.kv_me]
}

resource "azurerm_private_dns_zone" "kv" {
  name                = "privatelink.vaultcore.azure.net"
  resource_group_name = data.azurerm_resource_group.main.name
  tags                = local.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "kv" {
  name                  = "kv-link-${local.p}"
  resource_group_name   = data.azurerm_resource_group.main.name
  private_dns_zone_name = azurerm_private_dns_zone.kv.name
  virtual_network_id    = azurerm_virtual_network.main.id
}

resource "azurerm_private_endpoint" "kv" {
  name                = "pe-${local.p}-kv"
  resource_group_name = data.azurerm_resource_group.main.name
  location            = local.location
  subnet_id           = azurerm_subnet.pe.id
  tags                = local.tags
  private_service_connection {
    name                           = "kv"
    private_connection_resource_id = azurerm_key_vault.main.id
    subresource_names              = ["vault"]
    is_manual_connection           = false
  }
  private_dns_zone_group {
    name                 = "kv"
    private_dns_zone_ids = [azurerm_private_dns_zone.kv.id]
  }
}

# ── 이음 (공공존 서비스 계층) ──────────────────────────────────────────────
resource "azurerm_log_analytics_workspace" "main" {
  name                = "log-${local.p}"
  resource_group_name = data.azurerm_resource_group.main.name
  location            = local.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = local.tags
}

resource "azurerm_container_app_environment" "main" {
  name                       = "cae-${local.p}"
  resource_group_name        = data.azurerm_resource_group.main.name
  location                   = local.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  infrastructure_subnet_id   = azurerm_subnet.aca.id
  tags                       = local.tags
  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
  }
}

resource "azurerm_user_assigned_identity" "app" {
  name                = "id-${local.p}-app"
  resource_group_name = data.azurerm_resource_group.main.name
  location            = local.location
  tags                = local.tags
}

resource "azurerm_role_assignment" "app_acr" {
  scope                = data.azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.app.principal_id
}

resource "azurerm_container_app" "ieum" {
  name                         = "ca-${local.p}-ieum"
  resource_group_name          = data.azurerm_resource_group.main.name
  container_app_environment_id = azurerm_container_app_environment.main.id
  revision_mode                = "Single"
  workload_profile_name        = "Consumption"
  tags                         = local.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app.id]
  }
  registry {
    server   = data.azurerm_container_registry.acr.login_server
    identity = azurerm_user_assigned_identity.app.id
  }
  secret {
    name  = "ieum-secret-key"
    value = random_password.ieum_secret.result
  }
  secret {
    name  = "pg-reader-password"
    value = random_password.pg_reader.result
  }
  template {
    min_replicas = 1
    max_replicas = 1
    container {
      name   = "ieum"
      image  = var.container_image
      cpu    = 1.0
      memory = "2Gi"
      env {
        name        = "IEUM_SECRET_KEY"
        secret_name = "ieum-secret-key"
      }
      env {
        name  = "IEUM_PROBE_CIDRS"
        value = var.address_space # 서버발 요청은 이 VNet 안만
      }
      env {
        name  = "IEUM_DEMO_LEGACY_HOST"
        value = cidrhost(var.subnet_legacy, 10)
      }
      env {
        name  = "IEUM_DEMO_DB_HOST"
        value = azurerm_postgresql_flexible_server.legacy.fqdn
      }
      env {
        name  = "IEUM_DEMO_DB_PORT"
        value = "5432"
      }
      env {
        name  = "IEUM_DEMO_DB_USER"
        value = "pps_reader"
      }
      env {
        name        = "IEUM_DEMO_DB_PASSWORD"
        secret_name = "pg-reader-password"
      }
    }
  }
  ingress {
    external_enabled = true
    target_port      = 8000
    transport        = "auto"
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
    # DMZ F/W 모사 — 허용 대역만 들어온다. 이음 콘솔과 시연 원본은 인증 없이 열려 있으므로 비워 두지 않는다
    dynamic "ip_security_restriction" {
      for_each = var.allowed_cidrs
      content {
        name             = "allow-${ip_security_restriction.key}"
        action           = "Allow"
        ip_address_range = ip_security_restriction.value
      }
    }
  }
  lifecycle {
    ignore_changes = [template[0].container[0].image] # 이미지는 배포 스크립트가 바꾼다
  }
  depends_on = [azurerm_role_assignment.app_acr]
}
