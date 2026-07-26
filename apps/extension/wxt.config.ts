import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'MCP Studio Recorder',
    permissions: ['storage', 'sidePanel', 'tabs'],
    host_permissions: ['<all_urls>'],
    side_panel: { default_path: 'sidepanel.html' },
    web_accessible_resources: [{ resources: ['injected.js'], matches: ['<all_urls>'] }],
  },
});
