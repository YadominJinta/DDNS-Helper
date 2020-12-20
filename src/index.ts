// @deno-types="https://cdn.jsdelivr.net/npm/ky@0.25.1/index.d.ts";
import ky from "https://cdn.jsdelivr.net/npm/ky@0.25.1/index.js";
import { GetDNSRecords, PutDNSRecords, Addresses } from './interfaces.ts';

const config: { [index: string]: string } = {
  token: '',
  zone: '',
  domain: '',
  username: '',
  password: '',
  domainId: ''
};
let enableIpv6 = false;
const Red = "\x1b[31m";
const White = "\x1b[37m";

const parseArgument = () => {
  if (Deno.args.indexOf('--help') !== -1) {
    showHelp('')
    Deno.exit(0)
  }

  if (Deno.args.indexOf('--ipv6') !== -1)
    enableIpv6 = true;

  const args = [
    'token', 'zone', 'username', 'password', 'domain'
  ];

  args.forEach(arg => {
    if (Deno.args.indexOf('--' + arg) !== -1)
      config[arg] = Deno.args[Deno.args.indexOf('--' + arg) + 1];
    else
      showHelp(arg);
  });
}

const showHelp = (missing: string) => {
  if (missing)
    console.error(Red, `You need to specify ${missing}`)
  console.log(White, `
uestc-ddns: A script help you auto login and ddns in UESTC.

Arguments:
--token \t\t Your cloudflare token
--zone \t\t\t Your cloudflare zone id
--domain \t\t Your domain
--ipv6 \t\t\t Enable ipv6 support, default disabled
--username \t\t Your username to login the school network
--password \t\t Your password to login the school network
`)

  if (missing)
    Deno.exit(1);

}



const loginNetwork = async () => {
  try {
    const params = new URLSearchParams({
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
    });
    await ky.post("http://192.168.9.8/include/auth_action.php", {
      body: params.toString()
    });
  } catch (err) {
    console.table(err);
  }
}

const checkNetwork = async (time: number): Promise<boolean> => {
  if (time >= 5)
    return false;
  else {
    try {
      await ky.get('https://www.baidu.com', { timeout: 5000 });
      return true;
    } catch (err) {
      console.table(err);
      console.log('Try login...');
      await loginNetwork()
      return await checkNetwork(time + 1);
    }
  }
}

const getLocalAddress = async (): Promise<Addresses> => {
  try {
    let result = await ky.get('https://api-ipv4.ip.sb/ip').text();
    const ipv4 = result.replace('\n', '');

    if (enableIpv6) {
      result = await ky.get('https://api-ipv6.ip.sb/ip').text();
      const ipv6 = result.replace('\n', '');

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
    Deno.exit(1);
  }
}

const getDNSAddress = async (): Promise<Addresses> => {
  try {
    const result = await ky.get(
      `https://api.cloudflare.com/client/v4/zones/${config.zone}/dns_records`, {
      searchParams: {
        name: config.domain
      },
      headers: {
        Authorization: `Bearer ${config.token}`
      }
    }).json<GetDNSRecords>();

    if (result.success) {
      let ipv4 = '';
      let ipv6 = '';

      result.result.forEach(record => {
        if (record.type === 'A') {
          ipv4 = record.content;
        } else if (record.type === 'AAAA') {
          ipv6 = record.content;
        }
      });

      return enableIpv6 ?
        {
          ipv4: ipv4,
          ipv6: ipv6
        } :
        {
          ipv4: ipv4
        }
    } else {
      console.table(result);
      throw new Error("Can't get dns records");
    }
  } catch (err) {
    console.table(err.message);
    Deno.exit(1);
  }
}

const updateDNS = async (localAddress: Addresses) => {
  try {
    const records = await ky.get(
      `https://api.cloudflare.com/client/v4/zones/${config.zone}/dns_records`, {
      searchParams: {
        name: config.domain
      },
      headers: {
        Authorization: `Bearer ${config.token}`
      }
    }).json<GetDNSRecords>();

    await Promise.all(records.result.map(async (record) => {
      if (record.type === 'A') {
        try {
          const result = await ky.put(
            `https://api.cloudflare.com/client/v4/zones/${config.zone}/dns_records/${record.id}`, {
            headers: {
              Authorization: `Bearer ${config.token}`
            },
            body: JSON.stringify({
              content: localAddress.ipv4,
              type: 'A',
              ttl: 120,
              name: config.domain,
              proxied: false
            }),
          }).json<PutDNSRecords>();
          if (result.success) {
            console.log("Update dns for ipv4 success");
          } else {
            console.error("Update dns for ipv4 failed");
            console.table(result);
          }
        } catch (err) {
          console.error("Update dns for ipv4 failed");
          console.table(err.message);
        }
      } else if(record.type === 'AAAA' && localAddress.ipv6) {
        try {
          const result = await ky.put(
            `https://api.cloudflare.com/client/v4/zones/${config.zone}/dns_records/${record.id}`, {
            headers: {
              Authorization: `Bearer ${config.token}`
            },
            body: JSON.stringify({
              content: localAddress.ipv6,
              type: 'AAAA',
              ttl: 120,
              name: config.domain,
              proxied: false
            })
          }).json<PutDNSRecords>();

          if (result.success) {
            console.log("Update dns for ipv6 success");
          } else {
            console.error("Update dns for ipv6 failed");
            console.table(result);
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
  parseArgument();

  if (await checkNetwork(0)) {
    const localAddress = await getLocalAddress();
    const dnsAddress = await getDNSAddress();
    if (Object.is(localAddress, dnsAddress)) {
      await updateDNS(localAddress);
    } else {
      console.log('No problem');
    }
  }
  return;
}

main()
