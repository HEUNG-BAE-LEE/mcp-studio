output "name" { value = azurerm_container_app.this.name }
output "id" { value = azurerm_container_app.this.id }
output "environment_id" { value = azurerm_container_app_environment.this.id }
output "acr_id" { value = data.azurerm_container_registry.acr.id }
output "fqdn" { value = azurerm_container_app.this.ingress[0].fqdn }
output "identity_principal_id" { value = azurerm_user_assigned_identity.this.principal_id }
