variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone"
  type        = string
  default     = "us-central1-a"
}

variable "ssh_user" {
  description = "Linux user for SSH access"
  type        = string
  default     = "ubuntu"
}

variable "ssh_public_key_path" {
  description = "Path to your SSH public key"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

variable "om_download_url" {
  description = "Full URL to the Ops Manager .deb package (from https://www.mongodb.com/try/download/ops-manager)"
  type        = string
}

variable "om_version" {
  description = "Ops Manager version string, e.g. 8.0.4.100.20250212"
  type        = string
}

variable "mongodb_version" {
  description = "MongoDB version for AppDB (Community)"
  type        = string
  default     = "8.0"
}

variable "om_machine_type" {
  description = "Machine type for Ops Manager host"
  type        = string
  default     = "e2-standard-2"
}

variable "rs_machine_type" {
  description = "Machine type for replica set nodes"
  type        = string
  default     = "e2-medium"
}

variable "om_disk_size_gb" {
  description = "Boot disk size for Ops Manager host (GB)"
  type        = number
  default     = 30
}

variable "rs_disk_size_gb" {
  description = "Boot disk size for replica set nodes (GB)"
  type        = number
  default     = 20
}
