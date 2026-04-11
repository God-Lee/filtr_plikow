# TODO

Ten plik opisuje kierunki rozwoju aplikacji z perspektywy workflow użytkownika. Celem nie jest dopisywanie przypadkowych funkcji, tylko skracanie czasu od wejścia do aplikacji do poprawnie zakończonej operacji na plikach.

## Główny cel

Użytkownik ma móc:

1. szybko wejść w właściwy projekt,
2. zawęzić pliki bez gubienia kontekstu,
3. wykonać seryjną operację na właściwym zbiorze,
4. obsłużyć wyjątki bez ręcznego przeklikiwania wszystkiego,
5. wrócić do pracy po przerwaniu bez zaczynania od zera.

## Priorytety workflow

- Skrócić czas wejścia w pracę.
- Ograniczyć liczbę przełączeń między widokami i stanami.
- Zmniejszyć ryzyko pomyłki przy operacjach seryjnych.
- Zmniejszyć koszt obsługi wyjątków i błędów.
- Ułatwić wznawianie przerwanej sesji.

## Teraz

### T-001 Uporządkować start sesji

- Status: propozycja
- Cel workflow: po otwarciu aplikacji użytkownik ma od razu wiedzieć, co zrobić dalej i gdzie wrócić.
- Problem:
  obecny start nadal wymaga kilku decyzji naraz: wybór projektu, przypomnienie sobie ostatniego kroku, wybór widoku i ustawienie filtrów.
- Kierunek:
  wprowadzić jasny flow wejścia: `ostatni projekt / ulubione / wybór nowego`, a potem od razu pokazać ostatni sensowny stan pracy.
- Efekt:
  mniej czasu na orientację i mniej przypadkowego zaczynania od pustego stanu.

### T-002 Domknąć workflow selekcji

- Status: propozycja
- Cel workflow: użytkownik ma budować zestaw plików etapami bez obawy, że zgubi wybór.
- Problem:
  selekcja już nie resetuje się przy filtrach, ale sam workflow nadal można jeszcze uprościć i lepiej komunikować.
- Kierunek:
  traktować zaznaczenie jako osobny roboczy koszyk, widoczny stale w kontekście bieżącej pracy.
- Efekt:
  łatwiej przechodzić od `szukam` do `działam`, bez powtarzania tego samego filtrowania.

### T-003 Zmienić model pracy z wyjątkami

- Status: propozycja
- Cel workflow: użytkownik ma najpierw zrobić 80-90% pracy wsadowo, a dopiero potem zająć się wyjątkami.
- Problem:
  gdy poprawne i problematyczne przypadki są wymieszane, użytkownik traci rytm pracy i musi podejmować za dużo mikrodecyzji.
- Kierunek:
  po operacji seryjnej prowadzić użytkownika do kolejki wyjątków: błędy, ostrzeżenia, konflikty, brakujące dane.
- Efekt:
  główny workflow staje się szybki, a wyjątki są obsługiwane świadomie jako osobny etap.

### T-004 Uspójnić przejście Filtr -> Nazywanie -> Odkodowanie

- Status: propozycja
- Cel workflow: przejście między widokami ma być naturalną kontynuacją pracy, a nie zmianą kontekstu.
- Problem:
  jeśli użytkownik przechodzi do kolejnego widoku, musi mieć pewność, co dokładnie zostało przekazane i na czym teraz pracuje.
- Kierunek:
  zachować jeden ciąg roboczy: `wybrałem -> zaznaczyłem -> przekazałem -> wykonałem -> wróciłem`.
- Efekt:
  mniej niepewności, czy akcja dotyczy właściwego zestawu plików.

## Następne

### T-005 Dodać workflow "wznów pracę"

- Status: propozycja
- Cel workflow: po zamknięciu aplikacji albo przerwaniu pracy użytkownik wraca dokładnie tam, gdzie skończył.
- Problem:
  ponowne ustawianie projektu, filtrów, zaznaczeń i kontekstu kosztuje za dużo czasu.
- Kierunek:
  zapisywać stan sesji roboczej jako świadomy checkpoint, który można przywrócić.
- Efekt:
  aplikacja wspiera pracę przerywaną, a nie tylko jednorazowe sesje.

### T-006 Wprowadzić workflow preflight przed operacją zbiorczą

- Status: propozycja
- Cel workflow: przed kopiowaniem, zmianą nazw albo eksportem użytkownik widzi krótki, praktyczny przegląd ryzyk.
- Problem:
  przy pracy wsadowej najdroższe są błędy zauważone dopiero po wykonaniu operacji.
- Kierunek:
  przed wykonaniem akcji zbiorczej pokazywać krótki etap kontroli: ile plików, ile wyjątków, jakie są potencjalne konflikty, co zostanie pominięte.
- Efekt:
  mniej cofania pracy i mniej ostrożnego, ręcznego sprawdzania wszystkiego.

### T-007 Zbudować workflow "najpierw decyzje globalne"

- Status: propozycja
- Cel workflow: użytkownik najpierw ustala reguły wspólne, a dopiero potem dotyka pojedynczych rekordów.
- Problem:
  przy dużych zestawach plików ręczne poprawianie wiersz po wierszu szybko zabija tempo.
- Kierunek:
  prowadzić użytkownika przez kolejność:
  `ustal domyślne wartości -> zastosuj do zbioru -> pokaż odstępstwa -> popraw wyjątki`.
- Efekt:
  większość pracy staje się seryjna i przewidywalna.

### T-008 Ograniczyć "martwe przebiegi" po interfejsie

- Status: propozycja
- Cel workflow: użytkownik ma wykonywać mniej ruchów tylko po to, żeby zorientować się w stanie aplikacji.
- Problem:
  jeśli ważne informacje są rozrzucone między nagłówkiem, tabelą, filtrami i przyciskami, rośnie koszt poznawczy.
- Kierunek:
  uporządkować ekran wokół jednego roboczego pytania na danym etapie:
  `co teraz przeglądam`, `co jest zaznaczone`, `co mogę zrobić jako następny krok`.
- Efekt:
  mniej patrzenia po całym ekranie i mniej pomyłek przy szybkiej pracy.

## Później

### T-009 Dodać workflow presetów pracy

- Status: propozycja
- Cel workflow: użytkownik wraca do powtarzalnych scenariuszy bez ręcznego odtwarzania kroków.
- Problem:
  wiele operacji najpewniej będzie się powtarzać dla podobnych projektów i podobnych zestawów plików.
- Kierunek:
  potraktować najczęstsze przebiegi pracy jako gotowe scenariusze do uruchomienia i dostrojenia.
- Efekt:
  aplikacja skraca nie tylko pojedyncze kliknięcia, ale całe powtarzalne sekwencje pracy.

### T-010 Rozwinąć workflow keyboard-first

- Status: propozycja
- Cel workflow: zaawansowany użytkownik ma móc przejść główny flow bez ciągłego sięgania po myszkę.
- Problem:
  przy częstym użyciu największe straty czasu to drobne ruchy i przełączanie uwagi.
- Kierunek:
  zdefiniować najważniejszą ścieżkę klawiaturową dla `wybór projektu -> filtr -> selekcja -> akcja`.
- Efekt:
  szybsza praca operacyjna i lepsze poczucie kontroli.

### T-011 Dodać workflow podsumowania po akcji

- Status: propozycja
- Cel workflow: po wykonaniu operacji użytkownik od razu wie, co poszło dobrze, co wymaga reakcji i co może zrobić dalej.
- Problem:
  sama informacja, że "akcja się wykonała", nie wystarcza przy pracy na większej liczbie plików.
- Kierunek:
  po każdej większej operacji dawać krótki raport roboczy: wynik, wyjątki, możliwe następne kroki.
- Efekt:
  mniej ręcznego sprawdzania i mniej niepewności po zakończeniu zadania.

## Jak korzystać z tego pliku

- Gdy wybieramy następny etap prac, priorytetyzujemy workflow, nie listę pojedynczych funkcji.
- Każde nowe zadanie warto powiązać z jednym z punktów powyżej.
- Jeśli pojawia się nowy pomysł, dopisujemy go najpierw jako problem w przebiegu pracy użytkownika, a dopiero później jako rozwiązanie techniczne.
