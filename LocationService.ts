export const getUserLocation = async () => {
    try {
      const response = await fetch('https://ipapi.co/json/');
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to fetch location data:', error);
    }
    return { city: 'Unknown' };
  };