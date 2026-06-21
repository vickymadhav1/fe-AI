import './style.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

const script = document.createElement('script')
script.src = 'https://accounts.google.com/gsi/client'
document.head.appendChild(script)

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
