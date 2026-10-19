output "fqdn" { value = azurerm_postgresql_flexible_server.this.fqdn }
output "server_id" { value = azurerm_postgresql_flexible_server.this.id }
output "admin_login" { value = var.admin_login }
output "admin_password" {
  value     = random_password.admin.result
  sensitive = true
}
