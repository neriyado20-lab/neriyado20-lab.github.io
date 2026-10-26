(() => {
  'use strict';
  const search = document.querySelector('#bulletin-search');
  const year = document.querySelector('#bulletin-year');
  const groups = [...document.querySelectorAll('.year-group')];
  const count = document.querySelector('#result-count');
  const toggle = document.querySelector('#expand-years');
  const normalize = s => s.normalize('NFKC').replace(/[\u0591-\u05c7"'׳״\u200e\u200f]/g, '').toLocaleLowerCase().trim();
  function filter() {
    const words = normalize(search.value).split(/\s+/).filter(Boolean);
    let total = 0;
    for (const group of groups) {
      const matchesYear = !year.value || group.dataset.year === year.value;
      let visible = 0;
      for (const row of group.querySelectorAll('.bulletin')) {
        row.hidden = !matchesYear || !words.every(w => normalize(row.dataset.search).includes(w));
        if (!row.hidden) visible++;
      }
      group.hidden = !visible;
      group.querySelector('.year-count').textContent = `${visible} פריטים`;
      group.open = !!visible && (!!words.length || !!year.value);
      total += visible;
    }
    count.textContent = `${total} פריטים ${words.length || year.value ? 'תואמים לסינון' : 'בארכיון'}`;
    document.querySelector('#empty-state').hidden = total !== 0;
    updateToggle();
  }
  function updateToggle() {
    const visible = groups.filter(g => !g.hidden);
    toggle.disabled = visible.length === 0;
    toggle.textContent = visible.length && visible.every(g => g.open) ? 'סגירת כל השנים' : 'פתיחת כל השנים';
  }
  search.addEventListener('input', filter);
  year.addEventListener('change', filter);
  document.querySelector('#clear-filters').addEventListener('click', () => { search.value = ''; year.value = ''; filter(); search.focus(); });
  toggle.addEventListener('click', () => { const visible = groups.filter(g => !g.hidden); const open = !visible.every(g => g.open); visible.forEach(g => { g.open = open; }); updateToggle(); });
  groups.forEach(g => g.addEventListener('toggle', updateToggle));
  const requestedYear = new URLSearchParams(location.search).get('year');
  if (requestedYear && [...year.options].some(o => o.value === requestedYear)) { year.value = requestedYear; filter(); }
})();
