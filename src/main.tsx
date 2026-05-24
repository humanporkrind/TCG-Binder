import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'

if (localStorage.getItem('theme') === 'light') {
  document.documentElement.classList.add('light')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
