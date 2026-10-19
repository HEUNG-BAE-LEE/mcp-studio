# 망 구성 — KT G-Cloud 공공존 모사: DMZ/Private Tier(앱) · 기관 업무망(레거시) · Private Tier DB · 사설 엔드포인트
# 외부연동 F/W 는 nsg-legacy(앱 서브넷 → 레거시 포트만), Private F/W 는 nsg-pg(앱·레거시 → 5432 만)로 흉내 낸다.

resource "azurerm_virtual_network" "this" {
  name                = "vnet-${var.prefix}"
  resource_group_name = var.resource_group_name
  location            = var.location
  address_space       = [var.address_space]
  tags                = var.tags
}

resource "azurerm_subnet" "app" {
  name                 = "snet-${var.prefix}-aca"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = [var.subnets.app]
  delegation {
    name = "aca"
    service_delegation {
      name    = "Microsoft.App/environments"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "legacy" {
  name                 = "snet-${var.prefix}-legacy"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = [var.subnets.legacy]
  # 반입(apt · pip) 단계에만 인터넷을 쓴다. 밀봉은 NSG(internet_lockdown)가 한다
  default_outbound_access_enabled = true
}

resource "azurerm_subnet" "db" {
  name                 = "snet-${var.prefix}-pg"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = [var.subnets.db]
  service_endpoints    = ["Microsoft.Storage"]
  delegation {
    name = "pgflex"
    service_delegation {
      name    = "Microsoft.DBforPostgreSQL/flexibleServers"
      actions = ["Microsoft.Network/virtualNetworks/subnets/join/action"]
    }
  }
}

resource "azurerm_subnet" "pe" {
  name                 = "snet-${var.prefix}-pe"
  resource_group_name  = var.resource_group_name
  virtual_network_name = azurerm_virtual_network.this.name
  address_prefixes     = [var.subnets.pe]
}

# 외부연동 F/W 모사 — 레거시는 앱 서브넷에서 오는 레거시 포트만 받는다
resource "azurerm_network_security_group" "legacy" {
  name                = "nsg-${var.prefix}-legacy"
  resource_group_name = var.resource_group_name
  location            = var.location
  tags                = var.tags

  security_rule {
    name                       = "Allow-App-To-Legacy"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefix      = var.subnets.app
    source_port_range          = "*"
    destination_address_prefix = "*"
    destination_port_ranges    = var.legacy_ports
  }
  security_rule {
    name                       = "Deny-All-Inbound"
    priority                   = 4000
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_address_prefix      = "*"
    source_port_range          = "*"
    destination_address_prefix = "*"
    destination_port_range     = "*"
  }
  security_rule {
    name                       = "Allow-To-Legacy-DB"
    priority                   = 100
    direction                  = "Outbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefix      = "*"
    source_port_range          = "*"
    destination_address_prefix = var.subnets.db
    destination_port_range     = "5432"
  }
  dynamic "security_rule" {
    for_each = var.internet_lockdown ? [1] : []
    content {
      name                       = "Deny-Internet-Outbound" # 반입이 끝나면 밀봉한다
      priority                   = 4000
      direction                  = "Outbound"
      access                     = "Deny"
      protocol                   = "*"
      source_address_prefix      = "*"
      source_port_range          = "*"
      destination_address_prefix = "Internet"
      destination_port_range     = "*"
    }
  }
}

resource "azurerm_subnet_network_security_group_association" "legacy" {
  subnet_id                 = azurerm_subnet.legacy.id
  network_security_group_id = azurerm_network_security_group.legacy.id
}

resource "azurerm_network_security_group" "db" {
  name                = "nsg-${var.prefix}-pg"
  resource_group_name = var.resource_group_name
  location            = var.location
  tags                = var.tags

  security_rule {
    name                       = "Allow-App-And-Legacy-To-PG"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_address_prefixes    = [var.subnets.app, var.subnets.legacy]
    source_port_range          = "*"
    destination_address_prefix = "*"
    destination_port_range     = "5432"
  }
  security_rule {
    name                       = "Deny-VNet-Other"
    priority                   = 4000
    direction                  = "Inbound"
    access                     = "Deny"
    protocol                   = "*"
    source_address_prefix      = "VirtualNetwork"
    source_port_range          = "*"
    destination_address_prefix = "*"
    destination_port_range     = "*"
  }
}

resource "azurerm_subnet_network_security_group_association" "db" {
  subnet_id                 = azurerm_subnet.db.id
  network_security_group_id = azurerm_network_security_group.db.id
}
