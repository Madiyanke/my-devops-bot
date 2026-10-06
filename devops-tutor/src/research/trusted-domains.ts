import { hostnameOf } from '../common/text';

export type TrustLevel = 'official' | 'reputable' | null;

/** Documentation officielle des outils et plateformes DevOps. */
const OFFICIAL = [
  'kubernetes.io',
  'k8s.io',
  'docs.docker.com',
  'docker.com',
  'developer.hashicorp.com',
  'terraform.io',
  'vaultproject.io',
  'opentofu.org',
  'helm.sh',
  'kustomize.io',
  'prometheus.io',
  'grafana.com',
  'opentelemetry.io',
  'docs.github.com',
  'github.blog',
  'docs.gitlab.com',
  'jenkins.io',
  'argo-cd.readthedocs.io',
  'argoproj.github.io',
  'fluxcd.io',
  'istio.io',
  'linkerd.io',
  'cilium.io',
  'cncf.io',
  'etcd.io',
  'containerd.io',
  'podman.io',
  'opencontainers.org',
  'docs.k3s.io',
  'docs.aws.amazon.com',
  'aws.amazon.com',
  'learn.microsoft.com',
  'cloud.google.com',
  'docs.ansible.com',
  'ansible.com',
  'docs.redhat.com',
  'access.redhat.com',
  'docs.openshift.com',
  'nginx.org',
  'docs.nginx.com',
  'doc.traefik.io',
  'git-scm.com',
  'kernel.org',
  'man7.org',
  'postgresql.org',
  'redis.io',
  'elastic.co',
  'owasp.org',
  'trivy.dev',
  'sre.google',
  'pulumi.com',
  'docs.datadoghq.com',
  'nodejs.org',
  'go.dev',
  'docs.python.org',
  'ubuntu.com',
  'debian.org',
  'wiki.archlinux.org',
  'kind.sigs.k8s.io',
  'minikube.sigs.k8s.io',
  'cert-manager.io',
  'keda.sh',
  'docs.sonarsource.com',
];

/** Sources reconnues pour leur fiabilité (non officielles). */
const REPUTABLE = [
  'stackoverflow.com',
  'serverfault.com',
  'unix.stackexchange.com',
  'superuser.com',
  'devops.stackexchange.com',
  'wikipedia.org',
  'martinfowler.com',
  'digitalocean.com',
  'github.com',
  'learnk8s.io',
  'iximiuz.com',
  'thenewstack.io',
  'infoq.com',
  'brendangregg.com',
];

/** Domaines sans contenu textuel exploitable. */
const BLOCKED = [
  'youtube.com',
  'youtu.be',
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'twitter.com',
  'x.com',
  'pinterest.com',
  'linkedin.com',
  'quora.com',
  'reddit.com',
];

const matches = (host: string, domains: string[]) =>
  domains.some((d) => host === d || host.endsWith(`.${d}`));

export function trustLevel(url: string): TrustLevel {
  const host = hostnameOf(url);
  if (matches(host, OFFICIAL)) return 'official';
  if (matches(host, REPUTABLE)) return 'reputable';
  return null;
}

export function isBlocked(url: string): boolean {
  return matches(hostnameOf(url), BLOCKED);
}

/** Refuse les URL non HTTP(S) ou pointant vers le réseau interne (anti-SSRF). */
export function isSafePublicUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.svc') ||
    host.endsWith('.cluster.local') ||
    !host.includes('.')
  ) {
    return false;
  }
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    const [a, b] = host.split('.').map(Number);
    if (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    ) {
      return false;
    }
  }
  if (host.includes(':')) return false; // IPv6 littérale : refusée par prudence
  return true;
}
