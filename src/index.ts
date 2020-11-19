import qs from 'querystring';
import axios, { AxiosResponse } from 'axios';
import { GetDNSRecords, PutDNSRecords, Addresses } from './interfaces';

const config: { [index: string]: string } = {
  token: '',
  zone: '',
  domain: '',
  username: '',
  password: '',
  domain_id: ''
};
let enable_ipv6 = false;
const Red = "\x1b[31m";
const White = "\x1b[37m";

const show_help = (missing: string) => {
  if (missing)
    console.error(Red, `You need to specify ${missing}`)
  console.log(White, `
uestc-ddns: A script help you auto login and ddns in UESTC.

Arguments:
--token \t\t Your cloudflare token
--zone \t\t Your cloudflare zone id
--domain \t\t Your domain
--ipv6 \t\t\t Enable ipv6 support, default disabled
--username \t\t Your username to login the school network
--password \t\t Your password to login the school network
`)

  if (missing)
    process.exit(1)

}

const parse_argument = () => {
  process.argv;

  if (process.argv.indexOf('--help') !== -1) {
    show_help('')
    process.exit(0)
  }

  if (process.argv.indexOf('--ipv6') !== -1)
    enable_ipv6 = true;

  const args = [
    'token', 'zone', 'username', 'password', 'domain'
  ];

  args.forEach(arg => {
    if (process.argv.indexOf('--' + arg) !== -1)
      config[arg] = process.argv[process.argv.indexOf('--' + arg) + 1];
    else
      show_help(arg);
  });
}

const login_network = async () => {
  try {
    await axios.post("http://192.168.9.8/include/auth_action.php", qs.stringify({
      action: 'login',
      username: config.username,
      password: config.password,
      ac_id: '1',
      user_mac: '',
      user_ip: '',
      nas_ip: '',
      save_me: '0',
      domain: '@uestc',
      ajax: '1'
    }));
  } catch (err) {
    console.table(err);
  }
}

const check_network = async (time: number): Promise<boolean> => {
  if (time >= 5)
    return false;
  else {
    try {
      let result = await axios.get('https://www.baidu.com', { timeout: 500 });
      console.table(result.data)
      return true;
    } catch (err) {
      console.table(err);
      console.log('Try login...');
      await login_network()
      return await check_network(time + 1);
    }
  }
}

const getLocalAddress = async (): Promise<Addresses> => {
  try {
    let result = await axios.get('https://api-ipv4.ip.sb/ip');
    const ipv4 = result.data as string;

    if (enable_ipv6) {
      result = await axios.get('https://api-ipv6.ip.sb/ip');
      const ipv6 = result.data as string;

      return {
        ipv4: ipv4,
        ipv6: ipv6
      }
    }

    return {
      ipv4: ipv4
    }
  } catch (err) {
    console.table(err.message);
    process.exit(1)
  }
}

const getDNSAddress = async (): Promise<Addresses> => {
  try {
    let result: AxiosResponse<GetDNSRecords> = await axios.get(
      `https://api.cloudflare.com/client/v4/zones/${config.zone}/dns_records`, {
      params: {
        name: config.domain
      },
      headers: {
        Authorization: `Bearer ${config.token}`
      }
    });

    if (result.data.success) {
      let ipv4 = '';
      let ipv6 = '';

      result.data.result.forEach(record => {
        if (record.type === 'A') {
          ipv4 = record.content.replace('\n', '');
        } else if (record.type === 'AAAA') {
          ipv6 = record.content.replace('\n', '');
        }
      });

      return enable_ipv6 ?
        {
          ipv4: ipv4,
          ipv6: ipv6
        } :
        {
          ipv4: ipv4
        }
    } else {
      console.table(result.data);
      throw new Error("Can't get dns records");
    }
  } catch (err) {
    console.table(err.message);
    process.exit(1);
  }
}

const updateDNS = async (localAddress: Addresses) => {
  try {
    let records: AxiosResponse<GetDNSRecords> = await axios.get(
      `https://api.cloudflare.com/client/v4/zones/${config.zone}/dns_records`, {
      params: {
        name: config.domain
      },
      headers: {
        Authorization: `Bearer ${config.token}`
      }
    });

    await Promise.all(records.data.result.map(async (record) => {
      if (record.type === 'A') {
        try {
          let result: AxiosResponse<PutDNSRecords> = await axios.put(
            `https://api.cloudflare.com/client/v4/zones/${config.zone}/dns_records/${record.id}`,
            {
              content: localAddress.ipv4,
              type: 'A',
              ttl: 120,
              name: config.domain,
              proxied: false
            }, {
            headers: {
              Authorization: `Bearer ${config.token}`
            }
          }
          );
          if (result.data.success) {
            console.log("Update dns for ipv4 success");
          } else {
            console.error("Update dns for ipv4 failed");
            console.table(result.data);
          }
        } catch (err) {
          console.error("Update dns for ipv4 failed");
          console.table(err.message);
        }
      } else if(record.type === 'AAAA' && localAddress.ipv6) {
        try {
          let result: AxiosResponse<PutDNSRecords> = await axios.put(
            `https://api.cloudflare.com/client/v4/zones/${config.zone}/dns_records/${record.id}`,
            {
              content: localAddress.ipv6,
              type: 'AAAA',
              ttl: 120,
              name: config.domain,
              proxied: false
            }, {
            headers: {
              Authorization: `Bearer ${config.token}`
            }
          }
          );
          if (result.data.success) {
            console.log("Update dns for ipv6 success");
          } else {
            console.error("Update dns for ipv6 failed");
            console.table(result.data);
          }
        } catch (err) {
          console.error("Update dns for ipv6 failed");
          console.table(err.message);
        }
      }
    }));
  } catch (err) {
    console.table(err.message);
  }
}

const main = async () => {
  parse_argument();

  if (await check_network(0)) {
    const localAddress = await getLocalAddress();
    const dnsAddress = await getDNSAddress();
    if (localAddress !== dnsAddress) {
      await updateDNS(localAddress);
    }
  }
  return;
}

main()
