# Project Brief

Ten plik uzupełniamy przed większą iteracją. Ma ograniczać liczbę zmian "w locie" i zamrażać najważniejsze decyzje zanim zaczniemy kodować.

## Nazwa projektu

Filtr plików

## Jednozdaniowy cel

Desktopowe narzędzie do szybkiego filtrowania, porządkowania i przygotowywania plików projektowych bez ręcznej, powtarzalnej pracy na folderach i nazwach.

## Problem, który rozwiązujemy

- Ręczna praca na plikach jest wolna i podatna na błędy.
- Użytkownik potrzebuje szybkiego workflow: wybrać projekt, zawęzić pliki, nadać im poprawne nazwy lub statusy i przejść dalej bez chaosu w interfejsie.
- UI musi wspierać pracę operacyjną, więc ważniejsza od "efektowności" jest czytelność, wyrównanie i odporność na zwężanie okna.

## Główny użytkownik

- Osoba pracująca operacyjnie na plikach projektowych.
- Korzysta głównie na desktopie.
- Chce wykonać wiele podobnych operacji szybko i bez zgadywania.

## Główne flow

1. Wybrać projekt lub folder roboczy.
2. Zawęzić pliki przez filtry lub wyszukiwanie.
3. Przejrzeć wynik w czytelnej tabeli.
4. W razie potrzeby przejść do workflow nazewnictwa.
5. Nadać nazwy, statusy lub numery seryjnie.
6. Skopiować, wyeksportować albo zapisać wynik operacji.

## Zakres v1

- Wybór projektu i zapamiętywanie wygodnych ścieżek.
- Filtrowanie wyników po podstawowych kryteriach.
- Czytelna tabela wyników z akcjami.
- Workflow nazewnictwa dla serii plików.
- Walidacja kluczowych pól i czytelne komunikaty.
- Polski interfejs z naciskiem na szybkość pracy.

## Poza zakresem na teraz

- Rozbudowane zarządzanie użytkownikami lub rolami.
- Synchronizacja chmurowa.
- Wersja mobilna.
- Rozbudowane raportowanie, jeśli nie wpływa bezpośrednio na codzienny workflow.

## Kryteria akceptacji

- Główne flow da się przejść bez blokujących niejasności.
- UI pozostaje czytelne i nic się nie nakłada przy roboczych szerokościach desktopowych.
- Najczęstsze operacje da się wykonać szybciej niż ręcznie w eksploratorze plików.
- Mikrocopy jest spójne w całej aplikacji.
- Błędy walidacji jasno mówią, co poprawić.

## Zasady UI dla tego projektu

- Obowiązuje [UI_RULES.md](C:\Users\Piotr\Desktop\Codex\Filtr plików\UI_RULES.md).
- Najpierw stabilizujemy układ, potem copy, na końcu polish.
- Nie zamykamy zadania UI bez sprawdzenia zachowania przy zwężaniu okna.

## Ograniczenia techniczne

- Aplikacja desktopowa.
- Priorytetem jest płynność pracy na realnych danych i długich nazwach plików.
- Duże tabele i dropdowny muszą zachowywać się przewidywalnie w ograniczonej przestrzeni.

## Otwarte pytania do uzupełnienia

- Jakie dokładnie typy plików i reguły filtrowania są krytyczne?
- Które operacje muszą działać wsadowo od pierwszej wersji?
- Jakie błędy użytkownika zdarzają się najczęściej i trzeba im zapobiec w UI?
- Jakie skróty, automatyzacje lub presetowe akcje dadzą największą oszczędność czasu?

## Lista założeń roboczych

- Użytkownik pracuje głównie na jednym monitorze w układzie desktopowym.
- Priorytetem jest szybkość operacyjna, nie marketingowa prezentacja produktu.
- Liczba iteracji spadnie, jeśli nazwy pól, kolejność kroków i reguły UI zostaną zamrożone wcześnie.

## Brief dla kolejnego zadania

Przed startem nowej iteracji dopisz:

- co dokładnie ma powstać,
- co nie wchodzi do tej iteracji,
- po czym poznamy, że zadanie jest skończone,
- które ekrany lub komponenty wolno ruszać,
- jakie kompromisy są akceptowalne.
