output "vnet_id" { value = azurerm_virtual_network.this.id }
output "subnet_ids" {
  value = {
    app    = azurerm_subnet.app.id
    legacy = azurerm_subnet.legacy.id
    db     = azurerm_subnet.db.id
    pe     = azurerm_subnet.pe.id
  }
}
