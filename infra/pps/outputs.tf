output "ieum_url" {
  value = "https://${azurerm_container_app.ieum.ingress[0].fqdn}/ieum/"
}
output "legacy_private_ip" {
  value = azurerm_network_interface.legacy.private_ip_address
}
output "legacy_vm_name" {
  value = azurerm_linux_virtual_machine.legacy.name
}
output "pg_fqdn" {
  value = azurerm_postgresql_flexible_server.legacy.fqdn
}
output "key_vault_name" {
  value = azurerm_key_vault.main.name
}
output "container_app_name" {
  value = azurerm_container_app.ieum.name
}
