// Mounts each <div class="widget" data-widget="name"> with widgets/name.js. Options come from data-* attributes.
for (const el of document.querySelectorAll('.widget[data-widget]')) {
  import(`./widgets/${el.dataset.widget}.js`)
    .then((m) => m.mount(el, { ...el.dataset }))
    .catch((e) => { el.textContent = `This widget failed to load (${e.message}).`; console.error(e); });
}
