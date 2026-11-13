# Local security boundary verification

The status APIs expose a result projection rather than internal database rows.
Profile identifiers, saved-item identifiers and provider job identifiers are not
part of the shareable response. A profile identifier still acts as a capability in
the existing private-beta API; this change does not add an account/login system.

Public URL fetches use an explicit Undici dispatcher that binds connections to a
screened DNS address while retaining the original hostname for Host/TLS. Redirects
are screened again. Its abort deadline remains active during response consumption.
Motion inputs are read incrementally and cancelled at their byte cap; stored body
captures use the same 25 MiB ceiling as uploads. One failed source cancels the
other source download.

## Ingress and rate limits

By default, request-supplied forwarding headers are not trusted. Requests share the
conservative `unknown` bucket until an owner configures `CLOAK_TRUSTED_IP_HEADER`.
This can reduce throughput across users, including generation to six requests per
minute across that route. Set the variable only to a single-IP header which the
verified ingress **overwrites**, and restrict origin access so clients cannot
supply it directly. Comma-separated or malformed values remain untrusted. This PR
does not change deployment settings or establish the current ingress policy.

## Database TLS

Whenever database TLS is selected, the backend verifies both the chain and the
hostname/IP from `DATABASE_URL`. An operator-managed private CA may be supplied as
PEM in `DATABASE_SSL_CA`. TLS-control query parameters are removed before `pg`
parses the connection string, preventing a URL option from replacing this policy.
URL certificate/key file options are rejected; configure certificates separately.

Deployments using a self-signed/private CA must configure the correct CA before
adopting this change. An explicitly non-TLS private connection remains possible;
this patch does not claim all deployment paths use encryption. Node >=20.18.1 is
required by the explicitly pinned Undici 7.30.2 client (MIT), already a transitive
dependency before this change. Native fetch lacks its public
address-bound connection hook; using the maintained dispatcher avoids implementing
a separate HTTP/TLS client.

## Native profile transitions

Clear and successful replacement drop prior garment media, result/library state
and private in-memory evidence. An epoch invalidates stale asynchronous UI writes;
it does not cancel already-sent backend/provider work or guarantee secure erasure
of every temporary copy. The native XCTest target checks the rendered SwiftUI
feed after clearing A and
creating B, successful/failed replacement, delayed garment-import success/error,
and an avatar response arriving after clear. It uses dummy responses and locally
generated image markers. A negative control that removes garment clearing makes
the rendered-feed assertion fail; the production implementation passes. System
PhotosPicker interaction and real backend/provider cancellation are outside this
runtime proof.

## Verification scope

The added regression tests use dummy records, mocked uploads/generation and owned
loopback HTTP/PostgreSQL-TLS peers. No real provider, database or paid call is
required. TLS fixtures generate disposable keys in memory. Local verification uses
an empty environment and a read-only, network-isolated, resource-limited container.
The ordinary test command remains `npm test`; root lint and TypeScript checks are
separate. Deployment controls and native lifecycle/UI evidence are recorded in the
PR rather than inferred from these fixtures.
