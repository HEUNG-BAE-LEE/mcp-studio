# 비밀 금고 — RBAC, 사설 엔드포인트.
# 공개 접근을 금지하는 정책(RequestDisallowedByPolicy)이 걸린 구독이 있다. 그때는 public_during_apply=false 로 두고,
# 비밀값은 VNet 안(앱 · 관리 채널)에서 넣는다 — apply 하는 PC 는 데이터 평면에 닿지 못하므로 secrets 를 쓰지 않는다.

data "azurerm_client_config" "me" {}

resource "random_string" "suffix" {
  length  = 5
  upper   = false
  special = false
}

resource "azurerm_key_vault" "this" {
  name                          = "kv-${var.prefix}-${random_string.suffix.result}"
  resource_group_name           = var.resource_group_name
  location                      = var.location
  tenant_id                     = data.azurerm_client_config.me.tenant_id
  sku_name                      = "standard"
  rbac_authorization_enabled    = true
  purge_protection_enabled      = false
  soft_delete_retention_days    = 7
  public_network_access_enabled = var.public_during_apply
  tags                          = var.tags
}

resource "azurerm_role_assignment" "me" {
  scope                = azurerm_key_vault.this.id
  role_definition_name = "Key Vault Secrets Officer"
  principal_id         = data.azurerm_client_config.me.object_id
}

resource "azurerm_key_vault_secret" "this" {
  for_each     = var.public_during_apply ? nonsensitive(toset(keys(var.secrets))) : toset([])
  name         = each.value
  value        = var.secrets[each.value]
  key_vault_id = azurerm_key_vault.this.id
  depends_on   = [azurerm_role_assignment.me]
}

resource "azurerm_private_dns_zone" "this" {
  name                = "privatelink.vaultcore.azure.net"
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "this" {
  name                  = "kv-link-${var.prefix}"
  resource_group_name   = var.resource_group_name
  private_dns_zone_name = azurerm_private_dns_zone.this.name
  virtual_network_id    = var.vnet_id
}

resource "azurerm_private_endpoint" "this" {
  name                = "pe-${var.prefix}-kv"
  resource_group_name = var.resource_group_name
  location            = var.location
  subnet_id           = var.pe_subnet_id
  tags                = var.tags
  private_service_connection {
    name                           = "kv"
    private_connection_resource_id = azurerm_key_vault.this.id
    subresource_names              = ["vault"]
    is_manual_connection           = false
  }
  private_dns_zone_group {
    name                 = "kv"
    private_dns_zone_ids = [azurerm_private_dns_zone.this.id]
  }
}
