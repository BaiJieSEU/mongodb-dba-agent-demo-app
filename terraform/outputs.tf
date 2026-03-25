output "ops_manager_public_ip" {
  description = "Static public IP of the Ops Manager host"
  value       = google_compute_address.om_ip.address
}

output "ops_manager_ui_url" {
  description = "Ops Manager web UI URL"
  value       = "http://${google_compute_address.om_ip.address}:8080"
}

output "rs_node_ips" {
  description = "Internal IPs of replica set nodes"
  value = {
    for i, node in google_compute_instance.rs_node :
    node.name => {
      internal = node.network_interface[0].network_ip
      external = node.network_interface[0].access_config[0].nat_ip
    }
  }
}

output "ssh_om_host" {
  description = "SSH command for Ops Manager host"
  value       = "ssh ${var.ssh_user}@${google_compute_address.om_ip.address}"
}

output "ssh_rs_nodes" {
  description = "SSH commands for replica set nodes"
  value = {
    for node in google_compute_instance.rs_node :
    node.name => "ssh ${var.ssh_user}@${node.network_interface[0].access_config[0].nat_ip}"
  }
}
