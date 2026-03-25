resource "google_compute_network" "mongo_vpc" {
  name                    = "mongo-demo-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "mongo_subnet" {
  name          = "mongo-demo-subnet"
  ip_cidr_range = "10.10.0.0/24"
  region        = var.region
  network       = google_compute_network.mongo_vpc.id
}

# Allow SSH from anywhere
resource "google_compute_firewall" "allow_ssh" {
  name    = "mongo-demo-allow-ssh"
  network = google_compute_network.mongo_vpc.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["mongo-demo"]
}

# Allow Ops Manager web UI from anywhere
resource "google_compute_firewall" "allow_om_ui" {
  name    = "mongo-demo-allow-om-ui"
  network = google_compute_network.mongo_vpc.name

  allow {
    protocol = "tcp"
    ports    = ["8080", "8443"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["ops-manager"]
}

# Allow all internal traffic within the subnet (MongoDB, OM agents)
resource "google_compute_firewall" "allow_internal" {
  name    = "mongo-demo-allow-internal"
  network = google_compute_network.mongo_vpc.name

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = ["10.10.0.0/24"]
  target_tags   = ["mongo-demo"]
}
