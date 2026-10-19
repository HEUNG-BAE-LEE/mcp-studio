# 이음 앱 — Container Apps(VNet 연동). 공유 ACR 에서 관리 ID 로 이미지를 당긴다.
# 외부 노출은 허용 대역만(DMZ F/W 모사). 이음 콘솔과 시연 원본은 인증 없이 열려 있으므로 대역을 비워 둘 수 없다.

data "azurerm_container_registry" "acr" {
  name                = var.acr_name
  resource_group_name = var.acr_resource_group_name
}

resource "azurerm_log_analytics_workspace" "this" {
  name                = "log-${var.prefix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  tags                = var.tags
}

resource "azurerm_container_app_environment" "this" {
  name                       = "cae-${var.prefix}"
  resource_group_name        = var.resource_group_name
  location                   = var.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.this.id
  infrastructure_subnet_id   = var.subnet_id
  tags                       = var.tags
  workload_profile {
    name                  = "Consumption"
    workload_profile_type = "Consumption"
  }
}

resource "azurerm_user_assigned_identity" "this" {
  name                = "id-${var.prefix}-app"
  resource_group_name = var.resource_group_name
  location            = var.location
  tags                = var.tags
}

resource "azurerm_role_assignment" "acr_pull" {
  scope                = data.azurerm_container_registry.acr.id
  role_definition_name = "AcrPull"
  principal_id         = azurerm_user_assigned_identity.this.principal_id
}

resource "azurerm_container_app" "this" {
  name                         = "ca-${var.prefix}-${var.app_name}"
  resource_group_name          = var.resource_group_name
  container_app_environment_id = azurerm_container_app_environment.this.id
  revision_mode                = "Single"
  workload_profile_name        = "Consumption"
  tags                         = var.tags

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.this.id]
  }
  registry {
    server   = data.azurerm_container_registry.acr.login_server
    identity = azurerm_user_assigned_identity.this.id
  }
  dynamic "secret" {
    for_each = nonsensitive(toset(keys(var.secret_env)))
    content {
      name  = lower(replace(secret.value, "_", "-"))
      value = var.secret_env[secret.value]
    }
  }
  template {
    min_replicas = 1
    max_replicas = 1
    container {
      name   = var.app_name
      image  = var.image
      cpu    = var.cpu
      memory = var.memory
      dynamic "env" {
        for_each = var.env
        content {
          name  = env.key
          value = env.value
        }
      }
      dynamic "env" {
        for_each = nonsensitive(toset(keys(var.secret_env)))
        content {
          name        = env.value
          secret_name = lower(replace(env.value, "_", "-"))
        }
      }
    }
  }
  ingress {
    external_enabled = true
    target_port      = var.target_port
    transport        = "auto"
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
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
    ignore_changes = [template[0].container[0].image] # 이미지는 배포 스크립트(az containerapp update)가 바꾼다
  }
  depends_on = [azurerm_role_assignment.acr_pull]
}
