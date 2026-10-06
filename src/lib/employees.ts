// Lista pracowników do wyboru w generatorze. Wybranie osoby wypełnia formularz jej danymi.
//
// photoUrl: publiczny link do zdjęcia (odbiorcy pobierają je przy otwarciu wiadomości).
// Najlepiej kwadratowe, przycięte do ok. 84×84 px — większy plik w niektórych programach
// (np. Outlook) potrafi w odpowiedziach na maile wyświetlić się w pełnym rozmiarze.

export interface Employee {
  fullName: string;
  position: string;
  department?: string;
  email: string;
  phone?: string;
  mobile?: string;
  linkedin?: string;
  address?: string;
  photoUrl?: string;
}

export const EMPLOYEES: Employee[] = [
  // {
  //   fullName: 'Jan Kowalski',
  //   position: 'Key Account Manager',
  //   department: 'Sprzedaż',
  //   email: 'j.kowalski@nutripartners.co',
  //   phone: '+48 500 000 000',
  //   photoUrl: 'https://…/jan-kowalski.jpg',
  // },
];
