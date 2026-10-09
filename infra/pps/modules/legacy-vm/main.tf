# 레거시 서버 한 대 — 공인 IP 없음. 소프트웨어 반입은 관리 채널(az vm run-command)로만 한다.
# 매일 정해진 시각에 꺼지고(비용), 필요하면 켠다.

resource "azurerm_network_interface" "this" {
  name                = "nic-${var.name}"
  resource_group_name = var.resource_group_name
  location            = var.location
  tags                = var.tags
  ip_configuration {
    name                          = "ipcfg"
    subnet_id                     = var.subnet_id
    private_ip_address_allocation = "Static"
    private_ip_address            = var.private_ip
  }
}

resource "azurerm_linux_virtual_machine" "this" {
  name                            = "vm-${var.name}"
  resource_group_name             = var.resource_group_name
  location                        = var.location
  size                            = var.size
  admin_username                  = var.admin_username
  disable_password_authentication = true
  network_interface_ids           = [azurerm_network_interface.this.id]
  tags                            = var.tags

  admin_ssh_key {
    username   = var.admin_username
    public_key = var.admin_ssh_public_key
  }
  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "StandardSSD_LRS"
  }
  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }
  # 외부 스크립트를 curl | sh 로 받지 않는다 — 배포판 패키지만(폐쇄망 반입 취지)
  custom_data = base64encode(<<-EOT
    #cloud-config
    package_update: true
    packages: ${jsonencode(var.packages)}
    users:
      - default
      - name: ${var.service_user}
        system: true
        shell: /usr/sbin/nologin
    runcmd:
      - mkdir -p ${var.install_dir} && chown ${var.service_user}:${var.service_user} ${var.install_dir}
  EOT
  )
  lifecycle {
    # custom_data: 생성 시 1회만 — 바꾸면 VM 이 다시 만들어진다
    # identity: 구독 정책(Azure Policy · Defender 확장)이 시스템 관리 ID 를 붙인다. 떼면 정책과 싸운다
    ignore_changes = [custom_data, identity]
  }
}

resource "azurerm_dev_test_global_vm_shutdown_schedule" "this" {
  count                 = var.auto_shutdown_time == null ? 0 : 1
  virtual_machine_id    = azurerm_linux_virtual_machine.this.id
  location              = var.location
  enabled               = true
  daily_recurrence_time = var.auto_shutdown_time
  timezone              = "Korea Standard Time"
  notification_settings { enabled = false }
}
