# UI Rules

Ten plik jest źródłem prawdy dla decyzji UI w tym projekcie i w kolejnych iteracjach. Jeśli nowa zmiana koliduje z którąkolwiek zasadą poniżej, najpierw aktualizujemy ten dokument albo świadomie robimy wyjątek.

## Priorytety

1. Czytelność i szybkie skanowanie ekranu.
2. Równe wyrównanie pól, etykiet i akcji.
3. Brak nakładania się elementów przy zwężaniu okna.
4. Spójność nazewnictwa i mikrocopy.
5. Dopiero na końcu ozdobniki i dodatkowe efekty wizualne.

## Zasady główne

- Interfejs jest desktop-first, ale musi zachowywać się przewidywalnie przy zawężaniu okna.
- Zanim elementy zaczną się ściskać do nieczytelnego stanu, układ ma się przełamać, zawinąć albo przejść do jednej kolumny.
- Nie dopuszczamy do sytuacji, w której input, select, dropdown, tooltip albo panel nachodzi na sąsiednie pole lub zasłania kluczową akcję.
- Jeśli dwa elementy pełnią tę samą funkcję w tym samym kontekście, powinny mieć tę samą wysokość, podobny padding i podobny rytm odstępów.
- Gęstość interfejsu ma pomagać pracy, nie imponować liczbą elementów na ekranie.
- Kluczowe strefy nawigacyjne i brandingowe nie mogą zmieniać wymiarów między widokami ani przez zmianę liczby elementów dynamicznych.

## Stałe strefy layoutu

- Górny hero bar jest stałym kontenerem aplikacji. Jego wysokość i główne proporcje nie mogą zależeć od liczby ulubionych projektów ani od aktywnego widoku.
- Lewy górny blok hero, czyli miejsce na przycisk menu, nazwę modułu i znak `ekoinbud`, ma stałą szerokość, wysokość i położenie.
- Prawa część hero może zmieniać zawartość, ale nie może wypychać, ściskać ani przesuwać lewego bloku.
- Obszar na ulubione projekty musi być zaprojektowany na stan docelowy, a nie na minimalny. Jeśli wspieramy do `10` kart, kontener ma od początku mieć wymiar gotowy na dwa rzędy.
- Jeśli w danym widoku nie ma ulubionych lub innej zawartości w środku hero, zostawiamy stałą, pustą przestrzeń zamiast zmieniać wysokość lub rytm całej belki.
- Wysokość i kształt niebieskiej belki hero są elementem stałej struktury interfejsu i nie mogą się zmieniać między `Filtr`, `Nazywanie` i `Odkodowanie`.

## Wyrównanie

- W obrębie jednego bloku formularza wszystkie etykiety muszą zaczynać się na jednej linii optycznej.
- Wiersze typu `etykieta + kontrolka` mają korzystać z jednej stałej logiki szerokości, a nie z ręcznie dobieranych wyjątków dla każdego pola.
- Jeśli blok zawiera kilka kontrolek obok siebie, ich dolna krawędź i oś pionowa muszą być wyrównane.
- Grupy akcji po prawej stronie nagłówków nie mogą rozpychać tytułu ani łamać rytmu panelu.
- Długie etykiety nie mogą psuć siatki. Jeśli tekst jest dłuższy niż zakładaliśmy, układ ma to wytrzymać bez ręcznych korekt w kilku miejscach.

## Pola i formularze

- Pola tekstowe, selecty i przyciski w jednym obszarze roboczym mają wyglądać jak elementy jednego systemu, nie jak trzy różne komponenty.
- Każde pole, które może się zwężać, musi mieć świadomie ustawione `min-width: 0` po stronie kontenera lub dziecka, żeby nie wypychało układu.
- Układy formularzy budujemy na `grid` albo przewidywalnym `flex`, z jasnym zachowaniem na breakpointach. Nie polegamy na przypadkowym ściskaniu zawartości.
- Jeśli w jednym rzędzie są dwa lub więcej pól, to przy mniejszej szerokości mają:
  1. najpierw zachować wyrównanie,
  2. potem zmniejszyć się w bezpiecznym zakresie,
  3. a dopiero później przejść do zawijania lub stackowania.
- Placeholder nie może być jedynym nośnikiem instrukcji. Kluczowe znaczenie pola ma wynikać z etykiety.

## Responsywność i zmniejszanie okna

- Każda większa zmiana UI musi być sprawdzona co najmniej na szerokościach zbliżonych do `1600 px`, `1500 px` i `1366 px`.
- `1366 px` traktujemy jako obowiązkowy punkt kontrolny dla desktopu.
- Jeżeli wspieramy mniejsze szerokości niż `1366 px`, trzeba dodać jawny breakpoint i jawne reguły, a nie liczyć na to, że układ "sam się ułoży".
- Przy zmniejszaniu okna:
  - pola nie mogą nachodzić na siebie,
  - dropdowny nie mogą wychodzić poza viewport bez kontroli,
  - grupy przycisków muszą się zawijać zamiast ściskać do bezużytecznego stanu,
  - panel boczny nie może zabierać miejsca kosztem głównego flow, jeśli przez to formularz robi się nieczytelny.
- Jeśli jakiś element wymaga stałej szerokości, musi to być decyzja świadoma i uzasadniona jego funkcją.

## Tabele, listy i długie treści

- Tabela ma scrollować się wewnątrz własnego kontenera, zamiast rozwalać cały layout.
- Szerokości kolumn definiujemy świadomie. Kolumny krytyczne dla skanowania dostają priorytet, a mniej ważne mogą być ciaśniejsze.
- Długie nazwy plików, ścieżki i komunikaty walidacyjne muszą mieć przewidziane zachowanie: zawijanie, skrót albo tooltip.
- Nagłówek tabeli, akcje zbiorcze i zaznaczenia muszą pozostać czytelne także po zmniejszeniu szerokości.

## Dropdowny, autocomplete i warstwy nad interfejsem

- Dropdown i autocomplete są rozszerzeniem pola, nie osobnym bytem. Muszą być wizualnie i pozycją związane z polem bazowym.
- Menu rozwijane nie może mieć szerokości przypadkowej. Ma być wystarczająco szerokie dla treści, ale ograniczone viewportem.
- Warstwy typu menu, tooltip, popover i modal nie mogą zasłaniać ważnych akcji, jeśli da się tego uniknąć.
- Po otwarciu dropdownu focus, aktywny stan i obszar kliknięcia muszą być czytelne od razu.

## Copy i nazewnictwo

- Język interfejsu pozostaje po polsku.
- Etykiety mają być krótkie, konkretne i konsekwentne między ekranami.
- Jeśli zmieniamy nazwę pola albo sekcji, sprawdzamy całą aplikację pod kątem tej samej nazwy. Bez mieszania synonimów.
- Kroki workflow numerujemy tylko wtedy, gdy kolejność naprawdę ma znaczenie.

## Styl pracy przy zmianach UI

- Najpierw ustalamy układ i hierarchię, dopiero potem dopieszczamy spacing i copy.
- Jedna runda zmian UI powinna obejmować cały obszar problemu, nie pojedynczy detal bez sprawdzenia reszty ekranu.
- Jeśli zmiana dotyczy jednego komponentu współdzielonego, od razu sprawdzamy wszystkie miejsca użycia.
- Po każdej większej zmianie robimy szybki "resize pass", czyli kontrolę zachowania przy zwężaniu okna.

## Definition of Done dla UI

Zmiana UI jest gotowa dopiero wtedy, gdy:

- elementy są wyrównane optycznie i technicznie,
- nic się nie nakłada po zmniejszeniu szerokości,
- pola zachowują spójne rozmiary i odstępy,
- nazwy są spójne z resztą aplikacji,
- dropdowny, tabele i panele zachowują się przewidywalnie,
- cały ekran nadal da się szybko zeskanować bez szukania głównej akcji.

## Checklista przed zamknięciem zadania UI

- Czy pola w jednym rzędzie mają wspólną linię i wysokość?
- Czy po zwężeniu okna do około `1366 px` nic na nic nie nachodzi?
- Czy grupy akcji zawijają się zamiast ściskać?
- Czy tabela lub lista psuje layout, czy tylko przewija się wewnętrznie?
- Czy długie etykiety i długie nazwy plików nadal wyglądają kontrolowanie?
- Czy używam tych samych nazw, co w innych miejscach aplikacji?
- Czy poprawka jednego miejsca nie zepsuła pokrewnego widoku?
