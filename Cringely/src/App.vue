<template>
  <div class="page-layout">
    <section id="header_logo">
      <header class="header">
        <img src="@/assets/logo_v1.png" alt="Logo v1" class="logo1" />
      </header>
    </section>
    <section>
      <h1>Witaj na Stronie Startowej!</h1>
      <p>To jest pierwsza sekcja, ustawiona na samej górze.</p>
      <button class="btn primary">Rozpocznij</button>
    </section>

    <section id="services-section" class="content-container services-bg">
      <h2>Nasze Główne Usługi</h2>
      <p>Ten kontener pojawi się dokładnie pod pierwszym.</p>
      <div class="button-group">
        <button class="btn secondary">Zobacz Usługi</button>
        <button class="btn tertiary">Cennik</button>
      </div>
    </section>

    <section id="contact-section" class="content-container contact-bg">
      <h2>Skontaktuj Się z Nami</h2>
      <p>Ten kontener pojawi się dokładnie pod drugim, zamykając stronę.</p>
      <footer class="footer">
        <p>&copy; 2025 Prosta Strona Vue</p>
      </footer>
    </section>
  </div>
</template>

<script>
export default {
  name: 'HomeLayout',
}
</script>

<style scoped>
/* Definicja koloru i podstawowe style */
:root {
  --vue-green: rgb(0, 189, 126);
  --darker-green: rgb(0, 150, 100);
}

.class='logo1' {
  transform: scale(1.9);
}
.page-layout {
  /* Domyślny układ blokowy (display: block) sprawia,
     że elementy <section> automatycznie układają się jeden pod drugim */
  display: block;
  width: 100%;
  border-radius: 8px;
}

/* --- Style Kontenerów (Sekcji) --- */
.content-container {
  /* Podstawowe wypełnienie dla każdej sekcji */
  padding: 80px 20px;
  text-align: center;
  width: 100%;
  box-sizing: border-box; /* Ważne, by padding nie zwiększał szerokości ponad 100% */
}

/* Wyróżnienie sekcji różnymi tłami */
.header-bg {
  background-color: #ffffff; /* Białe tło */
  color: #333;
}

.services-bg {
  background-color: #f0f0f0; /* Szare tło */
  color: #333;
}

.contact-bg {
  background-color: var(--vue-green); /* Zielone tło */
  color: white;
}

/* --- Stylizacja Elementów Wewnętrznych --- */
.logo {
  margin-bottom: 20px;
  height: 100px;
}

h1,
h2 {
  margin-bottom: 10px;
}

p {
  margin-bottom: 30px;
}

.button-group {
  margin-top: 30px;
  display: flex;
  gap: 15px;
  justify-content: center;
}

/* --- Style Przycisków (z poprzedniego przykładu) --- */
.btn {
  padding: 10px 20px;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s ease;
  font-weight: bold;
}

.primary {
  background-color: var(--vue-green);
  color: white;
  border: none;
}

.primary:hover {
  background-color: var(--darker-green);
}

.secondary {
  background-color: white;
  color: var(--vue-green);
  border: 2px solid var(--vue-green);
}

.secondary:hover {
  background-color: var(--vue-green);
  color: white;
}

.tertiary {
  background-color: transparent;
  color: white;
  border: 2px solid white;
}

.tertiary:hover {
  background-color: rgba(255, 255, 255, 0.2);
}
</style>
