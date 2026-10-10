output "name" { value = azurerm_container_app.this.name }
output "fqdn" { value = azurerm_container_app.this.ingress[0].fqdn }
output "identity_principal_id" { value = azurerm_user_assigned_identity.this.principal_id }
