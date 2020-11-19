interface Record {
  id: string,
  zone_id: string,
  zone_name: string,
  name: string,
  type: string,
  content: string,
  proxiable: boolean,
  proxied: boolean,
  ttl: number,
  locked: boolean,
  meta: {
    auto_added: boolean,
    managed_by_apps: boolean,
    managed_by_argo_tunnel: boolean,
    source: string
  },
  created_on: string,
  modified_on: string
}

interface GetDNSRecords {
  result: Record[],
  success: boolean,
  errors: [],
  messages: []
}

interface PutDNSRecords {
  result: Record,
  success: boolean,
  errors: [],
  message: []
}

interface Addresses {
  ipv4: string,
  ipv6?: string
}

export {
  GetDNSRecords, Addresses, PutDNSRecords
}