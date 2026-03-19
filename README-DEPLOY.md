# How to deploy new version

## Build for Production

```powershell
# Create production build
npm run build

# Verify build output
Get-ChildItem dist/

# Preview production build locally
npm run preview
```

## Deploy on production

To deploy you need to have push `dist/` to your branch and got it merged on the main branch.
Create a new release on GitHub.
└── The release will trigger the rebase-prod workflow that will merge the main branch into the production branch
└──This will trigger the web-deploy workflow that will deploy it to production using ftp.

