## UESTC DDNS

DDNS Script for UESTC Shahe network.

Including auto login and cloudflare ddns.

### Usage

``` shell script
deno run --allow-net https://cdn.jsdelivr.net/gh/YadominJinta/DDNS-Helper/src/index.ts
 
uestc-ddns: A script help you auto login and ddns in UESTC.

Arguments:
--token                  Your cloudflare token
--zone                   Your cloudflare zone id
--domain                 Your domain
--ipv6                   Enable ipv6 support, default disabled
--username               Your username to login the school network
--password               Your password to login the school network
```


