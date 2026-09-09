# The frozen cohort's execution environment, reproducibly.
#
# The instrument freeze names the engine build, not just its hash:
#     engine.research.build = "ubuntu-x86-64-avx2"
# so the image is pinned to linux/amd64 and installs that exact release. On an AMD64 host this
# runs natively; the platform pin exists so the image cannot silently become an ARM build.
#
# Library versions are the ones the first eight members were actually scored under, read off the
# running container rather than guessed, because pandas 3 and numpy 1.26 are not an accidental
# pairing and a resolver left to itself will not reproduce it.

FROM --platform=linux/amd64 python:3.11-slim-bookworm

ARG SF_URL=https://github.com/official-stockfish/Stockfish/releases/download/sf_17.1/stockfish-ubuntu-x86-64-avx2.tar
ARG SF_SHA256=7fecbc0b26454b62be5e3b237b58dc5666401b56e520aeb1b0bf8f53fa8f2ef3

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl git procps \
    && rm -rf /var/lib/apt/lists/*

# The engine, verified against the freeze. A mismatch fails the build rather than producing an
# image that would score the cohort under an engine the freeze does not name.
RUN set -eux; \
    curl -fL --retry 3 "$SF_URL" -o /tmp/sf.tar; \
    mkdir -p /tmp/sf && tar -xf /tmp/sf.tar -C /tmp/sf; \
    SF_BIN="$(find /tmp/sf -type f -name 'stockfish-ubuntu-x86-64-avx2' | head -1)"; \
    test -n "$SF_BIN"; \
    echo "$SF_SHA256  $SF_BIN" | sha256sum -c -; \
    install -m 0755 "$SF_BIN" /usr/local/bin/stockfish; \
    rm -rf /tmp/sf /tmp/sf.tar; \
    stockfish <<< "uci" | head -1

RUN pip install --no-cache-dir \
        "numpy==1.26.4" \
        "pandas==3.0.5" \
        "pyarrow==25.0.1" \
        "scikit-learn==1.9.0" \
        "scipy==1.17.1" \
        "pysubgroup==0.9.0" \
        "requests==2.33.1" \
        "huggingface_hub==1.30.0"

WORKDIR /work
CMD ["/bin/bash"]
