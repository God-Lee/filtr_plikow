# Decisions

Ten plik służy do zapisywania ustaleń, które mają zatrzymać powracanie do tych samych tematów w kolejnych iteracjach. Jeśli coś jest ważną decyzją projektową albo UI-ową, zapisujemy to tutaj zamiast liczyć na pamięć rozmowy.

## Jak używać

- Jedna decyzja = jeden blok.
- Najnowsza aktywna decyzja wygrywa.
- Jeśli zmieniamy decyzję, nie kasujemy starej bez śladu. Dopisujemy nową i zaznaczamy, że zastępuje poprzednią.
- Gdy zadanie wchodzi w konflikt z decyzją, najpierw aktualizujemy ten plik albo świadomie robimy wyjątek.

## Aktywne decyzje

### D-001 Język interfejsu

- Status: aktywna
- Decyzja: interfejs pozostaje po polsku.
- Powód: to język roboczy użytkownika i najszybsza droga do bezbłędnej pracy.
- Konsekwencje: nowe etykiety, komunikaty i nazwy akcji dopasowujemy do istniejącego polskiego słownika.

### D-002 Priorytet UI

- Status: aktywna
- Decyzja: szybkość pracy i czytelność mają pierwszeństwo przed upychaniem maksymalnej liczby elementów na ekranie.
- Powód: w tym projekcie największe poprawki dotyczyły właśnie układu, wyrównań i klarowności interfejsu.
- Konsekwencje: przy konflikcie między gęstością a czytelnością wybieramy czytelność.

### D-003 Zachowanie przy zwężaniu okna

- Status: aktywna
- Decyzja: elementy mają się zawijać, stackować albo przewijać wewnątrz kontenera. Nie mogą się nakładać.
- Powód: nakładanie się pól i rozjeżdżanie layoutu było jednym z najczęściej wracających problemów.
- Konsekwencje: każda zmiana UI wymaga krótkiego testu przy mniejszej szerokości okna.

### D-004 Wyrównanie formularzy

- Status: aktywna
- Decyzja: pola w tej samej sekcji mają wspólną logikę wyrównania, wysokości i odstępów.
- Powód: poprawki do formularzy i widoku naming wielokrotnie dotyczyły właśnie niespójnych linii i szerokości.
- Konsekwencje: unikamy ręcznych wyjątków dla pojedynczych pól bez mocnego uzasadnienia.

### D-005 Tabele i długie dane

- Status: aktywna
- Decyzja: tabele mogą przewijać się poziomo wewnątrz panelu, ale nie mogą rozwalać całego układu.
- Powód: nazwy plików, statusy i walidacje mają zmienną długość i trzeba to kontrolować.
- Konsekwencje: szerokości kolumn definiujemy świadomie, a długie treści dostają przewidziane zachowanie.

## Tematy do doprecyzowania

- Minimalna szerokość, którą oficjalnie wspieramy bez kompromisów.
- Które operacje naming muszą być zawsze dostępne w jednym widoku, a które mogą być schowane głębiej.
- Które nazwy i skróty są finalne, a które nadal robocze.

## Szablon nowej decyzji

### D-XXX Tytuł decyzji

- Status: aktywna lub zastąpiona
- Data:
- Zastępuje:
- Decyzja:
- Powód:
- Konsekwencje:
- Wpływ na UI:
- Wpływ techniczny:

## Notatki operacyjne

- Jeśli ustalamy coś raz, co wpływa na więcej niż jeden ekran, zapisujemy to tutaj.
- Jeśli decyzja dotyczy tylko wyglądu i zachowania UI, aktualizujemy też [UI_RULES.md](C:\Users\Piotr\Desktop\Codex\Filtr plików\UI_RULES.md).
