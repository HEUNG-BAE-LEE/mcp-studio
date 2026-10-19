# 레거시 DB — PostgreSQL Flexible, 위임 서브넷 + Private DNS. 공개 접근 차단(Private Tier DB 모사).

resource "random_string" "suffix" {
  length  = 5
  upper   = false
  special = false
}

resource "random_password" "admin" {
  length  = 24
  special = false
}

resource "azurerm_private_dns_zone" "this" {
  name                = "${var.name}.private.postgres.database.azure.com"
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "this" {
  name                  = "pg-link-${var.name}"
  resource_group_name   = var.resource_group_name
  private_dns_zone_name = azurerm_private_dns_zone.this.name
  virtual_network_id    = var.vnet_id
}

resource "azurerm_postgresql_flexible_server" "this" {
  name                          = "pg-${var.name}-${random_string.suffix.result}"
  resource_group_name           = var.resource_group_name
  location                      = var.location
  version                       = var.pg_version
  sku_name                      = var.sku
  storage_mb                    = var.storage_mb
  administrator_login           = var.admin_login
  administrator_password        = random_password.admin.result
  delegated_subnet_id           = var.subnet_id
  private_dns_zone_id           = azurerm_private_dns_zone.this.id
  public_network_access_enabled = false
  tags                          = var.tags
  depends_on                    = [azurerm_private_dns_zone_virtual_network_link.this]
  lifecycle {
    ignore_changes = [zone] # Azure 가 고른 가용 영역을 다음 apply 에서 되돌리려다 실패하지 않게
  }
}

resource "azurerm_postgresql_flexible_server_database" "this" {
  for_each  = toset(var.databases)
  name      = each.value
  server_id = azurerm_postgresql_flexible_server.this.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}
