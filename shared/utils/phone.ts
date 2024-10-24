// utils/phoneData.ts

export const countryCodes = [
  { code: "+1", country: "Canada/USA", flag: "🇨🇦🇺🇸" }, // Canada/USA
  { code: "+44", country: "UK", flag: "🇬🇧" }, // UK
  { code: "+61", country: "Australia", flag: "🇦🇺" }, // Australia
  { code: "+91", country: "India", flag: "🇮🇳" }, // India
  { code: "+81", country: "Japan", flag: "🇯🇵" }, // Japan
  { code: "+49", country: "Germany", flag: "🇩🇪" }, // Germany
  { code: "+33", country: "France", flag: "🇫🇷" }, // France
  { code: "+39", country: "Italy", flag: "🇮🇹" }, // Italy
  { code: "+86", country: "China", flag: "🇨🇳" }, // China
  { code: "+55", country: "Brazil", flag: "🇧🇷" }, // Brazil
];

// This function could be expanded to handle more countries
export const formatPhoneNumber = (phone: string, countryCode: string) => {
  const cleaned = ("" + phone).replace(/\D/g, "");
  let match;
  if (countryCode === "+1") {
    match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
  }
  // Additional patterns for other countries can be added here
  return phone;
};
