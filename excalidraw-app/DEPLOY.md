# Deploying to GitHub Pages

The app is a static single-page app, so it can be hosted anywhere. GitHub Pages is wired up out of the box.

## How it works

`.github/workflows/deploy-pages.yml` runs on every push to `master`:

1. installs the dependencies,
2. builds the app with `yarn build:app:static`,
3. uploads `excalidraw-app/build` as the Pages artifact,
4. publishes it to `https://<user>.github.io/<repo>/`.

Because Pages serves the app from a sub-path, the build has to know about it. The workflow sets:

| Variable | Why |
| --- | --- |
| `VITE_APP_BASE_PATH` | `/<repo>/` — prefixes every asset url, the PWA manifest and the font preload links |
| `VITE_APP_HOSTNAME` | the public url, used for the sitemap |
| `VITE_APP_ENABLE_TRACKING` | `false` — no analytics are sent anywhere |
| `VITE_APP_LOCAL_FONTS` | `true` — the fonts are served from the deployment instead of the upstream CDN |

## Enabling it on the repository

Pages has to be switched on for the repository:

**Settings → Pages → Build and deployment → Source: _GitHub Actions_**

The first push to `master` then publishes the site. You can also trigger it manually from the **Actions → Deploy to GitHub Pages → Run workflow** menu.

## Custom domain

The site is published to `presentation.angkit.com.np`. A custom domain is configured under **Settings → Pages → Custom domain**, and it needs a matching DNS record, otherwise GitHub redirects the `github.io` address to a host that does not resolve.

For a domain on Cloudflare, add:

| Type  | Name           | Target                   | Proxy    |
| ----- | -------------- | ------------------------ | -------- |
| CNAME | `presentation` | `angkitkhadka.github.io` | DNS only |

Leave the proxy off — GitHub serves the site over TLS for the custom domain once the record is in place, and it issues the certificate itself. To go back to the `github.io` address, remove the custom domain under **Settings → Pages**.

## Building it yourself

```bash
yarn install
VITE_APP_BASE_PATH=/<repo>/ VITE_APP_LOCAL_FONTS=true yarn build:app:static
```

The result is in `excalidraw-app/build` — a plain folder of static files that can be served by any web server.

## Notes

- `404.html` is generated during the build and redirects unknown paths back into the app, so deep links keep working.
- `.nojekyll` is included so Pages serves the files as-is.
- The service worker caches the app for offline use. It is registered under the base path, so it only ever caches its own deployment.
