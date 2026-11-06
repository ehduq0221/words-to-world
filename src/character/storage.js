export function readCharacter() {
  try {
    const profile = JSON.parse(localStorage.getItem('words-to-world-character'));
    const fields = ['name', 'department', 'nationality', 'city', 'gender'];
    return profile && fields.every(key => typeof profile[key] === 'string' && profile[key].trim())
      ? profile : null;
  } catch {
    return null;
  }
}
