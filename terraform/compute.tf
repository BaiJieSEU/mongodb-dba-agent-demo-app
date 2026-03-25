locals {
  ssh_public_key = file(pathexpand(var.ssh_public_key_path))
  metadata = {
    ssh-keys = "${var.ssh_user}:${local.ssh_public_key}"
  }
}

# Static external IP for Ops Manager so the UI URL doesn't change
resource "google_compute_address" "om_ip" {
  name   = "om-static-ip"
  region = var.region
}

# ---------------------------------------------------------------
# Ops Manager host
# ---------------------------------------------------------------
resource "google_compute_instance" "ops_manager" {
  name                      = "om-host"
  machine_type              = var.om_machine_type
  zone                      = var.zone
  tags                      = ["mongo-demo", "ops-manager"]
  allow_stopping_for_update = true

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = var.om_disk_size_gb
      type  = "pd-balanced"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.mongo_subnet.id
    network_ip = "10.10.0.10"
    access_config {
      nat_ip = google_compute_address.om_ip.address
    }
  }

  metadata = local.metadata

  metadata_startup_script = templatefile("${path.module}/scripts/setup_om.sh", {
    mongodb_version = var.mongodb_version
    om_download_url = var.om_download_url
    om_version      = var.om_version
    om_host_ip      = "10.10.0.10"
  })

  service_account {
    scopes = ["cloud-platform"]
  }
}

# ---------------------------------------------------------------
# Replica set nodes (3x)
# ---------------------------------------------------------------
resource "google_compute_instance" "rs_node" {
  count                     = 3
  name                      = "rs-node-${count.index + 1}"
  machine_type              = var.rs_machine_type
  zone                      = var.zone
  tags                      = ["mongo-demo"]
  allow_stopping_for_update = true

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = var.rs_disk_size_gb
      type  = "pd-balanced"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.mongo_subnet.id
    network_ip = "10.10.0.${count.index + 11}"  # .11, .12, .13
    access_config {}                              # ephemeral external IP for SSH
  }

  metadata = local.metadata

  metadata_startup_script = file("${path.module}/scripts/setup_rs_node.sh")

  service_account {
    scopes = ["cloud-platform"]
  }
}
