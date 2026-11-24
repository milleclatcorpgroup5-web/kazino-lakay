// Kazino Lakay — seleksyon foutbolè reprezantan pou Penalty Lakay.
// Non jwè yo se chwa editoryal pou jwèt la, se pa yon klasman ofisyèl.
export const PENALTY_TEAMS = Object.freeze([
  { id: 'haiti', name: 'Ayiti', flag: '🇭🇹', primary: '#123b89', secondary: '#d92e43', player: { name: 'Duckens Nazon', shirtNumber: 10, role: 'Atakan' } },
  { id: 'france', name: 'Lafrans', flag: '🇫🇷', primary: '#174b9b', secondary: '#f5f7fb', player: { name: 'Kylian Mbappé', shirtNumber: 10, role: 'Atakan' } },
  { id: 'argentina', name: 'Ajantin', flag: '🇦🇷', primary: '#75bde8', secondary: '#f7f7f3', player: { name: 'Lionel Messi', shirtNumber: 10, role: 'Atakan' } },
  { id: 'brazil', name: 'Brezil', flag: '🇧🇷', primary: '#e6c51e', secondary: '#168344', player: { name: 'Neymar Jr.', shirtNumber: 10, role: 'Atakan' } },
  { id: 'cameroon', name: 'Kamewoun', flag: '🇨🇲', primary: '#16864a', secondary: '#d82d37', player: { name: 'Vincent Aboubakar', shirtNumber: 10, role: 'Atakan' } },
  { id: 'england', name: 'Angletè', flag: '🏴', primary: '#f1f2f5', secondary: '#c92f45', player: { name: 'Harry Kane', shirtNumber: 9, role: 'Atakan' } },
  { id: 'germany', name: 'Almay', flag: '🇩🇪', primary: '#292b31', secondary: '#d1ad34', player: { name: 'Jamal Musiala', shirtNumber: 10, role: 'Mitan atakan' } },
  { id: 'ghana', name: 'Gana', flag: '🇬🇭', primary: '#d52e36', secondary: '#e1c132', player: { name: 'Mohammed Kudus', shirtNumber: 20, role: 'Mitan atakan' } },
  { id: 'morocco', name: 'Mawòk', flag: '🇲🇦', primary: '#c51e36', secondary: '#16834c', player: { name: 'Achraf Hakimi', shirtNumber: 2, role: 'Defansè' } },
  { id: 'nigeria', name: 'Nijerya', flag: '🇳🇬', primary: '#16864a', secondary: '#f2f4ed', player: { name: 'Victor Osimhen', shirtNumber: 9, role: 'Atakan' } },
  { id: 'senegal', name: 'Senegal', flag: '🇸🇳', primary: '#16834c', secondary: '#e0c13c', player: { name: 'Sadio Mané', shirtNumber: 10, role: 'Atakan' } },
  { id: 'spain', name: 'Espay', flag: '🇪🇸', primary: '#cf283b', secondary: '#e9c33e', player: { name: 'Lamine Yamal', shirtNumber: 19, role: 'Atakan' } },
  { id: 'portugal', name: 'Pòtigal', flag: '🇵🇹', primary: '#bd263b', secondary: '#16864a', player: { name: 'Cristiano Ronaldo', shirtNumber: 7, role: 'Atakan' } },
  { id: 'tunisia', name: 'Tinizi', flag: '🇹🇳', primary: '#d32b36', secondary: '#f5f0e8', player: { name: 'Youssef Msakni', shirtNumber: 7, role: 'Atakan' } },
  { id: 'southafrica', name: 'Afrik di Sid', flag: '🇿🇦', primary: '#16834d', secondary: '#d8bd36', player: { name: 'Percy Tau', shirtNumber: 10, role: 'Atakan' } },
  { id: 'ivorycoast', name: 'Kotdivwa', flag: '🇨🇮', primary: '#ef8c26', secondary: '#16864a', player: { name: 'Sébastien Haller', shirtNumber: 22, role: 'Atakan' } }
]);

export function getPenaltyTeam(id) {
  return PENALTY_TEAMS.find((team) => team.id === id) || PENALTY_TEAMS[0];
}
