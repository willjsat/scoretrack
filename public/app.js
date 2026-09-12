const state = { data: null, status: null, type: 'spec', search: '' };
const colors = {'Death Knight':'#c41e3a','Demon Hunter':'#a330c9',Druid:'#ff7c0a',Evoker:'#33937f',Hunter:'#aad372',Mage:'#3fc7eb',Monk:'#00ff98',Paladin:'#f48cba',Priest:'#ffffff',Rogue:'#fff468',Shaman:'#0070dd',Warlock:'#8788ee',Warrior:'#c69b6d'};
const $ = selector => document.querySelector(selector);
const formatScore = score => Math.round(score).toLocaleString();
const initials = text => text.split(' ').map(word => word[0]).join('').slice(0, 2);

function render() {
  if (!state.data) return;
  const query = state.search.toLowerCase();
  const rows = state.data.rows.filter(row => row.type === state.type && `${row.className} ${row.specName ?? ''}`.toLowerCase().includes(query));
  $('#rows').innerHTML = rows.map(row => `<tr style="--class:${colors[row.className]}">
    <td><div class="identity"><span class="crest">${initials(row.specName ?? row.className)}</span><span class="name"><strong>${row.specName ?? row.className}</strong><small>${row.specName ? row.className : 'All specializations'}</small></span></div></td>
    ${row.error ? `<td colspan="3" class="players">Unavailable this refresh</td>` : `<td class="score">${formatScore(row.top5)}</td><td class="score hot">${formatScore(row.top1)}</td><td class="players">${row.population.toLocaleString()}</td>`}
  </tr>`).join('') || '<tr><td colspan="4" class="players">No matching rankings</td></tr>';
  $('#season').textContent = state.data.season.replace(/^season-/, '').replaceAll('-', ' ').toUpperCase();
  $('#updated').textContent = new Date(state.data.refreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function tick() {
  if (!state.status) return;
  const remaining = Math.max(0, new Date(state.status.nextRefreshAt) - Date.now());
  const hours = Math.floor(remaining / 3600000).toString().padStart(2, '0');
  const minutes = Math.floor(remaining % 3600000 / 60000).toString().padStart(2, '0');
  const seconds = Math.floor(remaining % 60000 / 1000).toString().padStart(2, '0');
  $('#countdown').textContent = state.status.refreshing ? 'REFRESHING…' : `${hours}:${minutes}:${seconds}`;
}

async function load() {
  try {
    const response = await fetch('/api/scores');
    const payload = await response.json();
    state.data = payload.data; state.status = payload.status;
    const notice = $('#notice');
    if (payload.status.lastError) { notice.textContent = `Latest refresh failed: ${payload.status.lastError}. Showing the last saved snapshot.`; notice.classList.remove('hidden'); }
    else if (!payload.data) { notice.textContent = 'Building the first worldwide snapshot. This can take a few minutes…'; notice.classList.remove('hidden'); }
    else notice.classList.add('hidden');
    render(); tick();
  } catch { $('#notice').textContent = 'Unable to connect to the ScoreTrack server.'; }
}

document.querySelectorAll('[data-type]').forEach(button => button.addEventListener('click', () => {
  document.querySelector('.tabs .active').classList.remove('active'); button.classList.add('active'); state.type = button.dataset.type; render();
}));
$('#search').addEventListener('input', event => { state.search = event.target.value; render(); });
load(); setInterval(tick, 1000); setInterval(load, 30000);
