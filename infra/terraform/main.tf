data "azurerm_resource_group" "rg" {
  name = var.resource_group_name
}

data "azurerm_container_registry" "acr" {
  name                = var.container_registry_name
  resource_group_name = data.azurerm_resource_group.rg.name
}

# --- Container Apps 환경 --------------------------------------------------------

# 로그 목적지가 없으면 컨테이너 표준출력을 볼 방법이 사라진다. 배포한 화면이
# 안 뜰 때 원인을 찾는 비용이 워크스페이스 비용보다 크다.
resource "azurerm_log_analytics_workspace" "logs" {
  name                = "log-${var.name_prefix}"
  location            = data.azurerm_resource_group.rg.location
  resource_group_name = data.azurerm_resource_group.rg.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

resource "azurerm_container_app_environment" "env" {
  name                       = "cae-${var.name_prefix}"
  location                   = data.azurerm_resource_group.rg.location
  resource_group_name        = data.azurerm_resource_group.rg.name
  log_analytics_workspace_id = azurerm_log_analytics_workspace.logs.id
  tags                       = var.tags

  # Azure 가 알아서 붙이는 기본 프로필이다. 코드에 적지 않으면 매 plan 이
  # "이걸 지우겠다"고 나와서 실제 변경과 구분이 안 된다.
  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
  }
}

# --- Container App --------------------------------------------------------------

# 앱이 ACR 에서 이미지를 당길 때 쓰는 신원. 앱보다 먼저 만들어 권한을 붙인다.
resource "azurerm_user_assigned_identity" "acr_pull" {
  name                = "id-acrpull-${var.name_prefix}"
  location            = data.azurerm_resource_group.rg.location
  resource_group_name = data.azurerm_resource_group.rg.name
  tags                = var.tags
}

resource "azurerm_role_assignment" "app_acr_pull" {
  scope                = data.azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.acr_pull.principal_id
}

locals {
  # 값이 채워진 것만 컨테이너에 내려보낸다. 빈 문자열을 시크릿으로 만들면
  # Container Apps 가 거부한다.
  openai_env = {
    for k, v in {
      AZURE_OPENAI_ENDPOINT    = var.azure_openai_endpoint
      AZURE_OPENAI_API_VERSION = var.azure_openai_api_version
      AZURE_OPENAI_DEPLOYMENT  = var.azure_openai_deployment
    } : k => v if v != ""
  }

  openai_key_set = var.azure_openai_api_key != ""
}

resource "azurerm_container_app" "app" {
  name                         = var.name_prefix
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = data.azurerm_resource_group.rg.name
  revision_mode                = "Single"
  workload_profile_name        = "Consumption"
  tags                         = var.tags

  # ACR 에서 이미지를 당길 주체. 시스템 할당 ID 를 쓰면 ID 가 앱과 같은 순간에
  # 생기므로 생성 시점에는 아직 AcrPull 권한이 없고, 그 상태로 레지스트리 설정을
  # 검증하다 프로비저닝이 겉돈다. 앱보다 먼저 만들어 권한까지 붙여 둔 사용자 할당
  # ID 를 쓰면 순서가 한 방향으로 정리된다.
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.acr_pull.id]
  }

  registry {
    server   = data.azurerm_container_registry.acr.login_server
    identity = azurerm_user_assigned_identity.acr_pull.id
  }

  dynamic "secret" {
    for_each = local.openai_key_set ? [1] : []
    content {
      name  = "azure-openai-api-key"
      value = var.azure_openai_api_key
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
  }

  template {
    min_replicas = var.min_replicas
    max_replicas = var.max_replicas

    container {
      name   = var.name_prefix
      image  = var.container_image
      cpu    = 0.5
      memory = "1Gi"

      dynamic "env" {
        for_each = local.openai_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.openai_key_set ? [1] : []
        content {
          name        = "AZURE_OPENAI_API_KEY"
          secret_name = "azure-openai-api-key"
        }
      }
    }
  }

  # 권한이 붙기 전에 앱이 만들어지면 레지스트리 검증에서 겉돈다.
  depends_on = [azurerm_role_assignment.app_acr_pull]

  lifecycle {
    # 이미지 태그는 GitHub Actions 가 커밋 SHA 로 바꾼다. Terraform 이 이것을
    # 되돌리면 apply 한 번에 배포가 과거로 굴러간다.
    ignore_changes = [
      template[0].container[0].image,
    ]
  }
}

# --- GitHub Actions 용 OIDC 신원 ------------------------------------------------
# 저장소 관리자 권한이 없어 시크릿을 넣을 수 없다. 그래서 비밀값이 필요 없는
# 연합 자격 증명(OIDC)을 쓴다. 워크플로에 남는 값은 client/tenant/subscription id
# 세 개이고, 이것들은 비밀이 아니다 — 아래 subject 에 적힌 저장소·브랜치에서 온
# 토큰만 이 신원으로 교환된다.
resource "azurerm_user_assigned_identity" "github" {
  name                = "id-github-${var.name_prefix}"
  location            = data.azurerm_resource_group.rg.location
  resource_group_name = data.azurerm_resource_group.rg.name
  tags                = var.tags
}

resource "azurerm_federated_identity_credential" "github_branch" {
  name                      = "github-${var.github_deploy_branch}"
  user_assigned_identity_id = azurerm_user_assigned_identity.github.id
  audience                  = ["api://AzureADTokenExchange"]
  issuer                    = "https://token.actions.githubusercontent.com"
  subject                   = "repo:${var.github_repository}:ref:refs/heads/${var.github_deploy_branch}"
}

# `az acr build` 는 레지스트리에서 빌드 작업을 예약하므로 푸시 권한만으로는 모자라다.
resource "azurerm_role_assignment" "github_acr" {
  scope                = data.azurerm_container_registry.acr.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_user_assigned_identity.github.principal_id
}

# 이미지 태그 교체만 하면 되므로 리소스 그룹이 아니라 이 앱 하나로 범위를 좁힌다.
resource "azurerm_role_assignment" "github_app" {
  scope                = azurerm_container_app.app.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_user_assigned_identity.github.principal_id
}
