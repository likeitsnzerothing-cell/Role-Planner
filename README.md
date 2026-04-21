# Role Planner · Warren Dev

Work roles & responsibilities planner. Desktop app for Windows.

---

## 🚀 How to Release a New Version

1. **Update version** in `package.json` (e.g. `1.8.0` → `1.9.0`)
2. **Update version strings** in `src/renderer/index.html` (titlebar + sidebar footer)
3. **Commit and push** your changes:
   ```
   git add .
   git commit -m "v1.9.0 — describe changes"
   git push
   ```
4. **Tag the release** (this triggers the build):
   ```
   git tag v1.9.0
   git push origin v1.9.0
   ```
5. GitHub Actions will automatically build the `.exe` installer and publish a GitHub Release.
6. Users will see the update banner in-app and can install with one click.

---

## 🛠 First-Time GitHub Setup

1. Create a **public** GitHub repo named `role-planner`
2. In `package.json` → `build.publish.owner`, replace `YOUR_GITHUB_USERNAME` with your actual username
3. Push this project to the repo:
   ```
   git init
   git remote add origin https://github.com/YOUR_USERNAME/role-planner.git
   git add .
   git commit -m "Initial commit v1.8.0"
   git push -u origin main
   ```
4. Go to repo **Settings → Actions → General** → set Workflow permissions to **Read and write**
5. Tag and push to trigger your first release build

---

## 📦 Data Storage

All data is stored locally at:
`C:\Users\<YOU>\AppData\Roaming\Role Planner\config.json`

Updates **never** touch your saved data.

---

© 2025 Eddie Warren · Warren Dev
