async function createEgress(map, environment, token) {
    let successCount = 0;
    let failureCount = 0;

    const hydraBaseUrl = "https://cloudapis.abcd.com/paas/v2/platforms/hydra/projects";
    const services = environment.endsWith("_ind")
        ? ['one-data-idl', 'one-data-staging-idl']
        : ['one-data', 'one-data-staging'];

    const missingEntries = [];

    for (const project of services) {
        const egressRules = await fetchEgressRulesByProject(environment, project, token);

        for (const [host, ports] of Object.entries(map)) {
            const missingPorts = isEgressRuleExists(egressRules, host, ports);

            if (missingPorts.length > 0) {
                missingEntries.push(`Host ${host} | Ports ${missingPorts.join(', ')} for project: ${project}`);
            } else {
                successCount++;
                console.log(`Successful - Egress already exists for host: ${host}. No further action needed.`);
            }
        }
    }

    if (failureCount > 0) {
        throw new Error('Job Failed to update Egress. Please check warnings/errors for more details and fix the issue.');
    }

    if (missingEntries.length > 0) {
        // TODO assign issue to SRE team
        throw new Error(`Missing Egress Entries: ${missingEntries.join('\n')}`);
    }
}

async function fetchEgressRulesByProject(env, project, token) {
    const url = `https://cloudapis.abcd.com/paas/v2/platforms/hydra/projects/${project}/egress`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    });

    if (response.status === 200) {
        const json = await response.json();
        return json.find(entry => entry.env === env)?.serviceEntries || [];
    } else {
        throw new Error(`Failed to fetch egress rules for project: ${project} with error: ${response.statusText}`);
    }
}

function isEgressRuleExists(egressRules, host, ports) {
    const egressRulesList = egressRules.filter(rule => rule.host === host);

    if (egressRulesList.length > 0) {
        const portFromResp = [...new Set(egressRulesList.flatMap(rule => rule.ports))];
        return ports.filter(port => !portFromResp.includes(port));
    }

    console.log(`No egress rule exists for host: ${host} and ports: ${ports}`);
    return ports;
}

function isIpAddress(host) {
    const ipv4Pattern = /^((25[0-5]|(2[0-4]|1\d|[1-9]|)\d)\.?){4}$/;
    return ipv4Pattern.test(host);
}
