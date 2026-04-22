# Changelog

## [0.1.1](https://github.com/shiner66/OsservatorioMIMIT-web/compare/v0.1.0...v0.1.1) (2026-04-22)


### Novità

* **cli:** --lan flag per esporre il server sulla rete locale ([a375c5d](https://github.com/shiner66/OsservatorioMIMIT-web/commit/a375c5dc4a02f191581b23da7d79485495b5119e))
* immagine Docker multi-arch + template Unraid ([c90167d](https://github.com/shiner66/OsservatorioMIMIT-web/commit/c90167d43f0a4a251b5fa35d2fbb714ddd3504c9))
* indicatore di stato CSV (scarico/elaboro) in header e banner mobile ([cbb6dbf](https://github.com/shiner66/OsservatorioMIMIT-web/commit/cbb6dbf8a5f293f9577344b94d47dd2a0846d663))
* pannello "Sperimentale" nella webui per il cap MIMIT a runtime ([0ab38b0](https://github.com/shiner66/OsservatorioMIMIT-web/commit/0ab38b08ed58bd5aff5b891e2f845a11a0abaae5))
* raggio fino a 30 km, preferiti, brand-first, indirizzi, HTTP geo ([b2ced56](https://github.com/shiner66/OsservatorioMIMIT-web/commit/b2ced56a4836912007c184c37ba0e6620cce5397))
* raggio MIMIT fino a 10 km (ufficiale) + override env per sperimentare ([911f38a](https://github.com/shiner66/OsservatorioMIMIT-web/commit/911f38a25eb6a8986865ba820f13107538d55921))


### Bug fix

* bind su 0.0.0.0 di default, --local-only per restringere a loopback ([eea7059](https://github.com/shiner66/OsservatorioMIMIT-web/commit/eea7059208c219d100375f6a8b5451b51dabd276))
* niente piu' blocco all'avvio in attesa dei CSV MIMIT ([53c6ba5](https://github.com/shiner66/OsservatorioMIMIT-web/commit/53c6ba552980f8a1f30aa4a7306b2f4d5f51a874))
* **ui:** i bottoni carburante non aggiornavano le preferenze ([e444f84](https://github.com/shiner66/OsservatorioMIMIT-web/commit/e444f84f81cfad2404d671d840457956363a318a))


### Refactor

* **docker:** cache CSV in tmpfs RAM, niente piu' volume persistente ([81eed9a](https://github.com/shiner66/OsservatorioMIMIT-web/commit/81eed9a6651095a8a6c50ecb559a76ec91b9d378))


### UX

* nascondi l'avviso HTTP geo una volta scelta una posizione ([a281972](https://github.com/shiner66/OsservatorioMIMIT-web/commit/a28197226f38e17c3e2a7e7ebc4a1bba29a1b6ba))


### Documentazione

* README con specifiche, guide Docker/Unraid e note tecniche ([915e5e5](https://github.com/shiner66/OsservatorioMIMIT-web/commit/915e5e5282257df081353f061c63d8d4c5abec60))


### CI/CD

* auto-crea release su tag push (v*) ([5020e58](https://github.com/shiner66/OsservatorioMIMIT-web/commit/5020e5835228284586a546423a124b81b9df49e4))
* auto-crea release su tag push (v*) ([074d116](https://github.com/shiner66/OsservatorioMIMIT-web/commit/074d116dea03c5e8d89795e115084c58c2034b5c))
* rimuovi macOS x86_64, solo Apple silicon (macos-14) ([4bbe581](https://github.com/shiner66/OsservatorioMIMIT-web/commit/4bbe581eb97ae0862ec4f88a8af05015cd23fc5e))
* versioning automatico via release-please + Conventional Commits ([7d1dce9](https://github.com/shiner66/OsservatorioMIMIT-web/commit/7d1dce9da86d1a675de77d4384df9e1a2358486a))


### Build

* verify local build + add multi-platform CI workflow ([27fbce8](https://github.com/shiner66/OsservatorioMIMIT-web/commit/27fbce8ee8d3cb630c71cd9fce5041baffc2e96b))
