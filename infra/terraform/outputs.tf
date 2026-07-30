output "app_url" {
  description = "배포된 관리자 화면 주소"
  value       = "https://${azurerm_container_app.app.ingress[0].fqdn}"
}

output "container_app_name" {
  value = azurerm_container_app.app.name
}

output "acr_login_server" {
  value = data.azurerm_container_registry.acr.login_server
}

# 아래 세 값을 .github/workflows/deploy-aca.yml 의 azure/login 단계에 넣는다.
output "github_actions_client_id" {
  description = "워크플로의 client-id"
  value       = azurerm_user_assigned_identity.github.client_id
}

output "github_actions_tenant_id" {
  value = azurerm_user_assigned_identity.github.tenant_id
}

output "github_actions_subscription_id" {
  value = var.subscription_id
}
