"""Trusted hosted-runner launcher; never import application modules on the host."""
import ipaddress
import json
import os
import pathlib
import re
import signal
import socket
import subprocess
import sys

IMAGE = 'node@sha256:9f0dde62d10e7ff7a310ecaebd66225f6b46c17e6cb778449a77b05d3541bea2'
subnet = ipaddress.ip_network('172.31.244.0/24')
app_ip, gateway = '172.31.244.10', '172.31.244.1'
run_id, attempt = os.environ['GITHUB_RUN_ID'], os.environ['GITHUB_RUN_ATTEMPT']
assert re.fullmatch(r'[0-9]{1,15}', run_id) and re.fullmatch(r'[0-9]{1,3}', attempt)
assert os.environ.get('PUBLIC_SOURCE') == 'true'
event = json.loads(pathlib.Path(os.environ['GITHUB_EVENT_PATH']).read_text())
assert event['repository']['private'] is False
label = run_id + '-' + attempt
volume, network, container = ('font-' + label + '-' + x for x in ['v', 'n', 'c'])
initializer, installer = ('font-' + label + '-' + x for x in ['init', 'install'])
forward_chain, input_chain = 'CF' + run_id + attempt + 'F', 'CF' + run_id + attempt + 'I'
created = set()


def interrupted(signum, frame):
    raise SystemExit(128 + signum)


signal.signal(signal.SIGTERM, interrupted)


def call(*args, capture=False, timeout=90):
    result = subprocess.run(args, check=True, text=True,
                            stdout=subprocess.PIPE if capture else None, timeout=timeout)
    return result.stdout if capture else None


def docker_json(*args):
    return json.loads(call('docker', *args, capture=True))


def firewall(*args, capture=False):
    return call('sudo', 'iptables', '-w', '10', *args, capture=capture)


def drop_packets(chain):
    rows = [line.split() for line in firewall('-L', chain, '-n', '-v', '-x', capture=True).splitlines()]
    drops = [int(row[0]) for row in rows if len(row) > 2 and row[2] == 'DROP']
    assert len(drops) == 1
    return drops[0]


def existing_container(name):
    ids = call('docker', 'container', 'ls', '-aq', '--no-trunc',
               '--filter', 'name=^/' + name + '$', capture=True).split()
    if not ids:
        return None
    assert len(ids) == 1
    item = docker_json('inspect', ids[0])[0]
    assert item['Name'] == '/' + name
    return item


def preparation(kind, name, options, command, timeout=90):
    call('docker', 'create', '--name', name, '--label', 'codex.incident.run=' + label,
         *options, IMAGE, *command)
    created.add(kind)
    call('docker', 'start', '-a', name, timeout=timeout)
    item = existing_container(name)
    assert item is not None and not item['State']['Running'] and item['State']['ExitCode'] == 0
    assert item['Config']['Labels'].get('codex.incident.run') == label
    call('docker', 'rm', item['Id'])
    created.remove(kind)


def cleanup():
    errors = []
    # Application must be gone before any restriction is removed.
    for kind, name in [('container', container), ('installer', installer), ('initializer', initializer)]:
        if kind not in created:
            continue
        try:
            item = existing_container(name)
            if item is not None:
                assert item['Config']['Labels'].get('codex.incident.run') == label
                call('docker', 'rm', '-f', item['Id'])
        except Exception as error:
            print('Owned container cleanup failed; retaining firewall restrictions', file=sys.stderr)
            return [repr(error)]
    for kind, chain, parent in [('forward', forward_chain, 'DOCKER-USER'), ('input', input_chain, 'INPUT')]:
        try:
            if kind + '-jump' in created:
                firewall('-D', parent, '-s', app_ip + '/32', '-j', chain)
            if kind in created:
                firewall('-F', chain)
                firewall('-X', chain)
        except Exception as error:
            errors.append(repr(error))
    for kind, name in [('network', network), ('volume', volume)]:
        if kind not in created:
            continue
        try:
            item = docker_json(kind, 'inspect', name)[0]
            assert item['Labels'].get('codex.incident.run') == label
            call('docker', kind, 'rm', name)
        except Exception as error:
            errors.append(repr(error))
    return errors


status = 1
try:
    # Fail rather than overlap a runner route or another Docker network.
    for route in json.loads(call('ip', '-j', '-4', 'route', capture=True)):
        if route.get('dst') not in (None, 'default'):
            assert not subnet.overlaps(ipaddress.ip_network(route['dst'], strict=False))
    ids = call('docker', 'network', 'ls', '-q', capture=True).split()
    for item in docker_json('network', 'inspect', *ids) if ids else []:
        for config in item.get('IPAM', {}).get('Config') or []:
            if config.get('Subnet') and ':' not in config['Subnet']:
                assert not subnet.overlaps(ipaddress.ip_network(config['Subnet']))
    for kind, name in [('volume', volume), ('network', network), ('container', container)]:
        probe = subprocess.run(['docker', kind, 'inspect', name], capture_output=True, text=True)
        assert probe.returncode != 0, 'Refusing an existing resource name'
    assert existing_container(initializer) is None and existing_container(installer) is None
    firewall('-L', 'DOCKER-USER', '-n')
    fonts = {}
    for host in ['fonts.googleapis.com', 'fonts.gstatic.com']:
        address = socket.getaddrinfo(host, 443, socket.AF_INET, socket.SOCK_STREAM)[0][4][0]
        assert ipaddress.ip_address(address).is_global
        fonts[host] = address
    print('Pinned public font IPv4 addresses:', json.dumps(fonts), flush=True)
    call('docker', 'pull', IMAGE, timeout=240)
    call('docker', 'volume', 'create', '--label', 'codex.incident.run=' + label, volume)
    created.add('volume')
    source = str(pathlib.Path(os.environ['GITHUB_WORKSPACE']).resolve())
    preparation('initializer', initializer, ['--network', 'none', '--security-opt', 'no-new-privileges',
         '--pids-limit', '256', '--memory', '3g', '--cpus', '2',
         '-v', source + ':/source:ro', '-v', volume + ':/work'], ['bash', '-euo', 'pipefail', '-c',
         "tar -C /source --exclude='.git' --exclude='.env*' --exclude='.ssh' "
         "--exclude='*.pem' --exclude='*.key' --exclude='*.p12' --exclude='*.pfx' "
         "--exclude='id_rsa*' --exclude='id_ed25519*' -cf - . | tar -C /work -xf -; "
         "chown -R 1000:1000 /work"])
    common = ['--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--pids-limit', '256',
              '--memory', '3g', '--cpus', '2', '--user', '1000:1000',
              '-e', 'HOME=/tmp', '-e', 'CI=true', '-v', volume + ':/work', '-w', '/work']
    preparation('installer', installer, [*common, '-e', 'NPM_CONFIG_CACHE=/tmp/npm'],
                ['npm', 'ci', '--ignore-scripts', '--no-audit', '--fund=false'], timeout=600)
    call('docker', 'network', 'create', '--driver', 'bridge', '--subnet', str(subnet),
         '--gateway', gateway, '--label', 'codex.incident.run=' + label, network)
    created.add('network')
    for kind, chain, parent in [('forward', forward_chain, 'DOCKER-USER'), ('input', input_chain, 'INPUT')]:
        firewall('-N', chain)
        created.add(kind)
        if kind == 'forward':
            for address in sorted(set(fonts.values())):
                firewall('-A', chain, '-d', address + '/32', '-p', 'tcp', '--dport', '443', '-j', 'ACCEPT')
        firewall('-A', chain, '-j', 'DROP')
        firewall('-I', parent, '1', '-s', app_ip + '/32', '-j', chain)
        created.add(kind + '-jump')
        firewall('-C', parent, '-s', app_ip + '/32', '-j', chain)
        assert firewall('-S', parent, capture=True).splitlines()[1].endswith('-j ' + chain), 'Jump must precede broad accepts'
    hosts = [part for host, address in fonts.items() for part in ['--add-host', host + ':' + address]]
    call('docker', 'create', '--name', container, '--label', 'codex.incident.run=' + label,
         '--network', network, '--ip', app_ip, '--dns', '127.0.0.1', '--dns-opt', 'timeout:1',
         '--dns-opt', 'attempts:1', '--sysctl', 'net.ipv6.conf.all.disable_ipv6=1',
         *hosts, *common, '-e', 'CI_GATEWAY=' + gateway, IMAGE, 'sleep', '1200')
    created.add('container')
    call('docker', 'start', container)
    item = docker_json('inspect', container)[0]
    assert set(item['NetworkSettings']['Networks']) == {network}
    assert item['NetworkSettings']['Networks'][network]['IPAddress'] == app_ip
    assert item['HostConfig']['Dns'] == ['127.0.0.1']
    assert item['HostConfig']['Sysctls']['net.ipv6.conf.all.disable_ipv6'] == '1'
    assert not item['HostConfig']['Privileged'] and item['HostConfig']['CapDrop'] == ['ALL']
    assert len(item['Mounts']) == 1 and item['Mounts'][0]['Name'] == volume
    assert item['Mounts'][0]['Type'] == 'volume' and item['Mounts'][0]['Destination'] == '/work'
    before = (drop_packets(forward_chain), drop_packets(input_chain))
    call('docker', 'exec', container, 'node', '.github/scripts/check-ci-boundary-fonts.cjs', timeout=60)
    after = (drop_packets(forward_chain), drop_packets(input_chain))
    assert all(new > old for old, new in zip(before, after)), 'Actual firewall traversal not established'
    print('Owned firewall traversal verified:', before, after, flush=True)
    call('docker', 'exec', container, 'npm', '--ignore-scripts', 'run', 'check', timeout=900)
    status = 0
finally:
    errors = cleanup()
    if errors:
        print('Owned CI cleanup failed:', errors, file=sys.stderr)
        status = 1
    else:
        print('Owned container, firewall, network and volume cleanup completed', flush=True)
sys.exit(status)
