// [JAVARI-FIX] .github/workflows/audit.yml
name: Registry Lifecycle Audit

on:
  push:
    branches:
      - main

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v3

      - name: Run Audit
        run: npm install && npm audit