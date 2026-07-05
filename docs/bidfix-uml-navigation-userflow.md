# BidFix: UML, Struktur Navigasi, dan User Flow

Dokumen ini dibuat dari implementasi yang ada saat ini di folder `frontend/` dan `backend/`.

## Ringkasan Aplikasi

BidFix adalah marketplace jasa perbaikan berbasis web dengan 3 role utama:

- `user`: membuat request perbaikan, memilih merchant, dan melakukan pembayaran
- `merchant`: melihat request, mengirim penawaran, mengerjakan order, dan upload bukti kerja
- `admin`: memantau sistem dan memverifikasi merchant

Komponen pendukung yang sudah ada di codebase:

- AI Assistant
- payment gateway Midtrans
- model escrow, dispute, review, knowledge base, dan service partner

Catatan implementasi:

- fitur `review`, `dispute`, dan `escrow` sudah ada di backend/model, tetapi belum ditemukan halaman frontend khusus
- tombol `Reject` pada halaman verifikasi admin belum menyimpan status reject ke backend; yang persisten baru `Approve`

## 1. UML Arsitektur Sistem

```mermaid
flowchart TD
    Guest[Guest]
    User[User]
    Merchant[Merchant]
    Admin[Admin]

    subgraph Frontend[Frontend Web]
        Landing[Landing Page + Auth Modal]
        UserDash[User Dashboard]
        MerchantDash[Merchant Dashboard]
        MerchantOffers[Merchant My Offers]
        MerchantOrders[Merchant Orders]
        MerchantHistory[Merchant History]
        AdminDash[Admin Dashboard]
        AdminVerify[Admin Verify Merchant]
        AIWidget[AI Widget]
    end

    subgraph Backend[Backend Express API]
        AuthAPI[/Auth API/]
        MasterAPI[/Users, Merchants, Categories/]
        RequestAPI[/Requests, Bids, Orders/]
        PaymentAPI[/Payments + Gateway API/]
        ReviewAPI[/Reviews, Disputes, Escrow/]
        AIAPI[/AI API/]
    end

    subgraph Services[External/Internal Services]
        Midtrans[Midtrans Snap]
        KB[(Knowledge Base)]
        SP[(Service Partners)]
        DB[(MySQL + Sequelize Models)]
    end

    Guest --> Landing
    User --> UserDash
    Merchant --> MerchantDash
    Merchant --> MerchantOffers
    Merchant --> MerchantOrders
    Merchant --> MerchantHistory
    Admin --> AdminDash
    Admin --> AdminVerify

    Landing --> AuthAPI
    UserDash --> RequestAPI
    UserDash --> PaymentAPI
    UserDash --> AIWidget
    MerchantDash --> RequestAPI
    MerchantDash --> AIWidget
    MerchantOffers --> RequestAPI
    MerchantOrders --> RequestAPI
    MerchantOrders --> PaymentAPI
    MerchantHistory --> RequestAPI
    AdminDash --> MasterAPI
    AdminDash --> RequestAPI
    AdminDash --> PaymentAPI
    AdminDash --> AIWidget
    AdminVerify --> MasterAPI
    AIWidget --> AIAPI

    AuthAPI --> DB
    MasterAPI --> DB
    RequestAPI --> DB
    PaymentAPI --> DB
    ReviewAPI --> DB
    AIAPI --> DB
    PaymentAPI --> Midtrans
    AIAPI --> KB
    AIAPI --> SP
```

## 2. UML Use Case

Catatan:

- di UML, relasi standar yang dipakai adalah `<<include>>` dan `<<extend>>`
- kalau yang dimaksud "exclude", biasanya dalam diagram use case yang benar adalah `<<extend>>`

```mermaid
flowchart LR
    Guest[Guest]
    User[User]
    Merchant[Merchant]
    Admin[Admin]

    subgraph BidFix
        UC1([Lihat landing page])
        UC2([Register])
        UC3([Login])
        UC4([Gunakan AI assistant])
        UC5([Buat request perbaikan])
        UC6([Lihat detail request])
        UC7([Pilih merchant])
        UC8([Bayar DP])
        UC9([Pantau order berjalan])
        UC10([Bayar pelunasan])
        UC11([Lihat request terbaru])
        UC12([Kirim penawaran])
        UC13([Kelola penawaran saya])
        UC14([Proses order masuk])
        UC15([Upload bukti kerja])
        UC16([Lihat history order])
        UC17([Lihat dashboard monitoring])
        UC18([Verifikasi merchant])

        INC1([Isi data akun])
        INC2([Pilih role akun])
        INC3([Validasi kredensial])
        INC4([Redirect sesuai role])
        INC5([Isi form request])
        INC6([Pilih kategori])
        INC7([Lihat daftar bid])
        INC8([Buat order])
        INC9([Tandai bid terpilih])
        INC10([Tutup request])
        INC11([Generate invoice])
        INC12([Proses pembayaran gateway])
        INC13([Cek status pembayaran])
        INC14([Isi harga, ETA, catatan])
        INC15([Cek status DP])
        INC16([Lihat detail merchant])

        EXT1([Register merchant])
        EXT2([Rekomendasi service partner])
        EXT3([Mulai pengerjaan])
        EXT4([Approve merchant])
    end

    Guest --> UC1
    Guest --> UC2
    Guest --> UC3
    Guest --> UC4

    User --> UC5
    User --> UC6
    User --> UC7
    User --> UC8
    User --> UC9
    User --> UC10
    User --> UC4

    Merchant --> UC11
    Merchant --> UC12
    Merchant --> UC13
    Merchant --> UC14
    Merchant --> UC15
    Merchant --> UC16

    Admin --> UC17
    Admin --> UC18
    Admin --> UC4

    UC2 -.->|&lt;&lt;include&gt;&gt;| INC1
    UC2 -.->|&lt;&lt;include&gt;&gt;| INC2
    UC3 -.->|&lt;&lt;include&gt;&gt;| INC3
    UC3 -.->|&lt;&lt;include&gt;&gt;| INC4
    UC5 -.->|&lt;&lt;include&gt;&gt;| INC5
    UC5 -.->|&lt;&lt;include&gt;&gt;| INC6
    UC6 -.->|&lt;&lt;include&gt;&gt;| INC7
    UC7 -.->|&lt;&lt;include&gt;&gt;| INC8
    UC7 -.->|&lt;&lt;include&gt;&gt;| INC9
    UC7 -.->|&lt;&lt;include&gt;&gt;| INC10
    UC8 -.->|&lt;&lt;include&gt;&gt;| INC11
    UC8 -.->|&lt;&lt;include&gt;&gt;| INC12
    UC8 -.->|&lt;&lt;include&gt;&gt;| INC13
    UC10 -.->|&lt;&lt;include&gt;&gt;| INC11
    UC10 -.->|&lt;&lt;include&gt;&gt;| INC12
    UC10 -.->|&lt;&lt;include&gt;&gt;| INC13
    UC12 -.->|&lt;&lt;include&gt;&gt;| INC14
    UC14 -.->|&lt;&lt;include&gt;&gt;| INC15
    UC18 -.->|&lt;&lt;include&gt;&gt;| INC16

    EXT1 -.->|&lt;&lt;extend&gt;&gt;| UC2
    EXT2 -.->|&lt;&lt;extend&gt;&gt;| UC4
    EXT3 -.->|&lt;&lt;extend&gt;&gt;| UC14
    UC15 -.->|&lt;&lt;extend&gt;&gt;| UC14
    EXT4 -.->|&lt;&lt;extend&gt;&gt;| UC18
```

### 2.1 Relasi Include dan Extend

#### Include

- `Register` `<<include>>` `Isi data akun`
- `Register` `<<include>>` `Pilih role akun`
- `Login` `<<include>>` `Validasi kredensial`
- `Login` `<<include>>` `Redirect sesuai role`
- `Buat request perbaikan` `<<include>>` `Isi form request`
- `Buat request perbaikan` `<<include>>` `Pilih kategori`
- `Lihat detail request` `<<include>>` `Lihat daftar bid`
- `Pilih merchant` `<<include>>` `Buat order`
- `Pilih merchant` `<<include>>` `Tandai bid terpilih`
- `Pilih merchant` `<<include>>` `Tutup request`
- `Bayar DP` `<<include>>` `Generate invoice`
- `Bayar DP` `<<include>>` `Proses pembayaran gateway`
- `Bayar DP` `<<include>>` `Cek status pembayaran`
- `Bayar pelunasan` `<<include>>` `Generate invoice`
- `Bayar pelunasan` `<<include>>` `Proses pembayaran gateway`
- `Bayar pelunasan` `<<include>>` `Cek status pembayaran`
- `Kirim penawaran` `<<include>>` `Isi harga, ETA, catatan`
- `Proses order masuk` `<<include>>` `Cek status DP`
- `Verifikasi merchant` `<<include>>` `Lihat detail merchant`

#### Extend

- `Register merchant` `<<extend>>` `Register`
- `Rekomendasi service partner` `<<extend>>` `Gunakan AI assistant`
- `Mulai pengerjaan` `<<extend>>` `Proses order masuk`
- `Upload bukti kerja` `<<extend>>` `Proses order masuk`
- `Approve merchant` `<<extend>>` `Verifikasi merchant`

## 3. UML Class Diagram

```mermaid
classDiagram
    class User {
      +id
      +name
      +email
      +password
      +phone
      +role
      +address
      +verified
    }

    class Merchant {
      +id
      +user_id
      +business_name
      +category_list
      +verified_documents
      +rating_cache
      +wallet_balance
    }

    class Category {
      +id
      +name
      +parent_id
    }

    class Request {
      +id
      +user_id
      +title
      +description
      +category_id
      +location_lat
      +location_lng
      +min_bid_amount
      +mode_service
      +status
      +expires_at
    }

    class Bid {
      +id
      +request_id
      +merchant_id
      +price
      +eta
      +note
      +is_selected
    }

    class Order {
      +id
      +request_id
      +bid_id
      +user_id
      +merchant_id
      +total_price
      +dp_amount
      +status
      +scheduled_at
      +proof_photos
      +completed_at
    }

    class Payment {
      +id
      +order_id
      +user_id
      +merchant_id
      +amount
      +type
      +status
      +provider_txn_id
    }

    class PaymentLog {
      +id
      +order_id
      +payment_id
      +doku_invoice_id
      +request_id
      +external_id
      +idempotency_key
      +status
      +payload
    }

    class EscrowLedger {
      +id
      +order_id
      +amount
      +held_since
      +release_at
      +released_to
      +status
    }

    class Review {
      +id
      +order_id
      +user_id
      +merchant_id
      +rating
      +comment
    }

    class Dispute {
      +id
      +order_id
      +opened_by
      +opener_id
      +reason
      +status
      +resolution
    }

    class AiChatLog {
      +id
      +user_id
      +session_id
      +user_message
      +ai_response
      +intent
      +sentiment
      +risk_level
    }

    class KnowledgeBase {
      +id
      +title
      +content
      +category
      +tags
    }

    class ServicePartner {
      +id
      +name
      +address
      +latitude
      +longitude
      +rating
      +verified
      +popularity
      +response_speed
    }

    User "1" --> "0..1" Merchant
    User "1" --> "0..*" Request
    Category "1" --> "0..*" Request
    Request "1" --> "0..*" Bid
    Merchant "1" --> "0..*" Bid
    Request "1" --> "0..1" Order
    Bid "1" --> "0..1" Order
    User "1" --> "0..*" Order
    Merchant "1" --> "0..*" Order
    Order "1" --> "0..*" Payment
    Payment "1" --> "0..*" PaymentLog
    Order "1" --> "0..*" PaymentLog
    Order "1" --> "0..1" EscrowLedger
    Order "1" --> "0..1" Review
    Order "1" --> "0..1" Dispute
    User "1" --> "0..*" Review
    Merchant "1" --> "0..*" Review
    User "1" --> "0..*" AiChatLog
```

## 4. ERD

```mermaid
erDiagram
    USERS {
        int id PK
        string name
        string email
        string password
        string phone
        string role
        double location_lat
        double location_lng
        text address
        boolean verified
        date created_at
        date updated_at
    }

    MERCHANTS {
        int id PK
        int user_id FK
        string business_name
        json category_list
        json verified_documents
        float rating_cache
        decimal wallet_balance
        date created_at
        date updated_at
    }

    CATEGORIES {
        int id PK
        string name
        int parent_id FK
        date created_at
    }

    REQUESTS {
        int id PK
        int user_id FK
        int category_id FK
        string title
        text description
        double location_lat
        double location_lng
        decimal min_bid_amount
        string mode_service
        string status
        date created_at
        date expires_at
    }

    BIDS {
        int id PK
        int request_id FK
        int merchant_id FK
        decimal price
        date eta
        text note
        boolean is_selected
        date created_at
        date updated_at
    }

    ORDERS {
        int id PK
        int request_id FK
        int bid_id FK
        int user_id FK
        int merchant_id FK
        decimal total_price
        decimal dp_amount
        string status
        date scheduled_at
        json proof_photos
        date completed_at
        date created_at
        date updated_at
    }

    PAYMENTS {
        int id PK
        int order_id FK
        int user_id FK
        int merchant_id FK
        decimal amount
        string type
        string status
        string provider_txn_id
        date created_at
    }

    PAYMENT_LOGS {
        int id PK
        int order_id FK
        int payment_id FK
        string doku_invoice_id
        string request_id
        string external_id
        string idempotency_key
        string status
        json payload
        date created_at
        date updated_at
    }

    ESCROW_LEDGER {
        int id PK
        int order_id FK
        decimal amount
        date held_since
        date release_at
        text release_policy
        int released_to
        string status
    }

    REVIEWS {
        int id PK
        int order_id FK
        int user_id FK
        int merchant_id FK
        int rating
        text comment
        date created_at
    }

    DISPUTES {
        int id PK
        int order_id FK
        string opened_by
        int opener_id
        text reason
        string status
        text admin_notes
        text resolution
        date created_at
        date resolved_at
    }

    AI_CHAT_LOGS {
        int id PK
        int user_id FK
        string session_id
        text user_message
        text ai_response
        string intent
        string sentiment
        string risk_level
        date created_at
    }

    KNOWLEDGE_BASE {
        int id PK
        string title
        text content
        string category
        string source
        json tags
        json embedding
        date created_at
        date updated_at
    }

    SERVICE_PARTNERS {
        int id PK
        string name
        text address
        double latitude
        double longitude
        decimal rating
        boolean verified
        text description
        int popularity
        int response_speed
        date created_at
        date updated_at
    }

    USERS ||--o| MERCHANTS : has
    USERS ||--o{ REQUESTS : creates
    CATEGORIES ||--o{ REQUESTS : categorizes
    CATEGORIES o|--o{ CATEGORIES : parent_of
    REQUESTS ||--o{ BIDS : receives
    MERCHANTS ||--o{ BIDS : submits
    REQUESTS ||--o| ORDERS : becomes
    BIDS ||--o| ORDERS : selected_for
    USERS ||--o{ ORDERS : places
    MERCHANTS ||--o{ ORDERS : handles
    ORDERS ||--o{ PAYMENTS : has
    USERS ||--o{ PAYMENTS : pays
    MERCHANTS ||--o{ PAYMENTS : receives
    ORDERS ||--o{ PAYMENT_LOGS : logs
    PAYMENTS ||--o{ PAYMENT_LOGS : tracked_by
    ORDERS ||--o| ESCROW_LEDGER : escrowed_in
    ORDERS ||--o| REVIEWS : reviewed_in
    USERS ||--o{ REVIEWS : writes
    MERCHANTS ||--o{ REVIEWS : receives
    ORDERS ||--o| DISPUTES : disputed_in
    USERS ||--o{ AI_CHAT_LOGS : chats
```

Catatan ERD:

- `knowledge_base` dan `service_partners` saat ini berdiri sendiri dan dipakai oleh service AI
- `escrow_ledger`, `reviews`, dan `disputes` sudah punya tabel dan relasi, tetapi UI frontend-nya belum lengkap

## 5. UML Sequence Diagram: Alur Bisnis Utama

```mermaid
sequenceDiagram
    actor U as User
    actor M as Merchant
    participant FE as Frontend
    participant API as Backend API
    participant PG as Midtrans
    participant DB as Database

    U->>FE: Buat request perbaikan
    FE->>API: POST /requests
    API->>DB: simpan Request(status=open)
    DB-->>API: request tersimpan
    API-->>FE: request created

    M->>FE: Lihat request terbaru
    FE->>API: GET /requests?status=open
    API->>DB: ambil request open
    DB-->>API: daftar request
    API-->>FE: tampilkan request

    M->>FE: Kirim penawaran
    FE->>API: POST /bids
    API->>DB: simpan Bid
    DB-->>API: bid tersimpan
    API-->>FE: bid created

    U->>FE: Buka detail request dan pilih merchant
    FE->>API: POST /orders
    API->>DB: simpan Order
    FE->>API: PUT /bids/:id(is_selected=true)
    FE->>API: PUT /requests/:id(status=closed)

    U->>FE: Bayar DP / final
    FE->>API: POST /payment/create
    API->>PG: create Snap transaction
    PG-->>API: snap token + invoice
    API->>DB: simpan Payment + PaymentLog
    API-->>FE: snap token
    FE->>PG: buka popup pembayaran
    PG-->>API: callback status
    API->>DB: update Payment / PaymentLog / Order

    M->>FE: Mulai pengerjaan
    FE->>API: PUT /orders/:id(status=in_progress)
    API->>DB: update Order

    M->>FE: Upload bukti kerja
    FE->>API: PUT /orders/:id(status=awaiting_confirmation, proof_photos)
    API->>DB: update Order

    U->>FE: Bayar pelunasan
    FE->>API: cek status payment
    API->>DB: update status completed
    API-->>FE: order selesai
```

## 6. Struktur Navigasi

### 6.1 Peta Navigasi Global

```text
BidFix
|-- Landing Page
|   |-- Login Modal
|   |-- Register Modal
|   `-- AI Widget
|
|-- User
|   `-- Dashboard
|       |-- Form Buat Request
|       |-- Yang Sedang Berjalan
|       |-- Daftar Request
|       |-- Detail Request Modal
|       |-- Pilih Merchant Modal
|       |-- Payment / Pelunasan Modal
|       |-- Action / Confirmation Modal
|       `-- AI Widget
|
|-- Merchant
|   |-- Request Terbaru
|   |   |-- Detail Request Modal
|   |   `-- AI Widget
|   |-- Penawaran Saya
|   |   `-- Detail Penawaran Modal
|   |-- Order Masuk
|   |   `-- Upload Bukti Kerja Modal
|   `-- History
|       `-- Detail History Modal
|
`-- Admin
    |-- Dashboard
    |   `-- AI Widget
    `-- Verifikasi Merchant
        `-- Detail Verifikasi Modal
```

### 6.2 Diagram Navigasi Antar Halaman

```mermaid
flowchart LR
    Landing[Landing Page]
    UserDash[User Dashboard]
    MerchantDash[Merchant Request Terbaru]
    MerchantOffers[Merchant Penawaran Saya]
    MerchantOrders[Merchant Order Masuk]
    MerchantHistory[Merchant History]
    AdminDash[Admin Dashboard]
    AdminVerify[Admin Verifikasi Merchant]

    Landing -->|login/register user| UserDash
    Landing -->|login merchant tervalidasi| MerchantDash
    Landing -->|login admin| AdminDash

    MerchantDash <--> MerchantOffers
    MerchantOffers <--> MerchantOrders
    MerchantOrders <--> MerchantHistory
    MerchantDash <--> MerchantOrders

    AdminDash <--> AdminVerify
```

## 7. User Flow

### 7.1 User Flow: User

```mermaid
flowchart TD
    A[Landing] --> B{Sudah punya akun?}
    B -->|Belum| C[Register sebagai user]
    B -->|Sudah| D[Login]
    C --> E[Masuk ke User Dashboard]
    D --> E
    E --> F[Buat request perbaikan]
    F --> G[Request tampil di daftar]
    G --> H[Merchant mengirim bid]
    H --> I[User buka detail request]
    I --> J[Pilih merchant]
    J --> K[Order dibuat dan request ditutup]
    K --> L[Bayar DP]
    L --> M[Merchant mulai pengerjaan]
    M --> N[Merchant upload bukti kerja]
    N --> O[User lihat lampiran]
    O --> P[Bayar pelunasan]
    P --> Q[Order selesai]
```

### 7.2 User Flow: Merchant

```mermaid
flowchart TD
    A[Landing] --> B[Register sebagai merchant]
    B --> C[Status pending verifikasi admin]
    C --> D[Admin approve]
    D --> E[Login merchant]
    E --> F[Halaman Request Terbaru]
    F --> G[Kirim penawaran]
    G --> H[Masuk ke Penawaran Saya]
    H --> I{Bid dipilih user?}
    I -->|Tidak| F
    I -->|Ya| J[Masuk ke Order Masuk]
    J --> K{DP sukses?}
    K -->|Belum| J
    K -->|Sudah| L[Mulai pengerjaan]
    L --> M[Upload bukti kerja]
    M --> N[Menunggu pelunasan user]
    N --> O[Order pindah ke History]
```

### 7.3 User Flow: Admin

```mermaid
flowchart TD
    A[Login admin] --> B[Masuk ke Dashboard]
    B --> C[Lihat statistik merchant, transaksi, revenue]
    B --> D[Buka halaman Verifikasi Merchant]
    D --> E[Lihat detail merchant]
    E --> F[Approve merchant]
    F --> G[Merchant bisa login]
```

### 7.4 User Flow: AI Assistant

```mermaid
flowchart TD
    A[User buka AI Widget] --> B[Pilih quick action atau ketik pertanyaan]
    B --> C[Frontend kirim ke /api/ai/chat]
    C --> D[AI Controller baca session dan user context]
    D --> E[Knowledge retrieval / rekomendasi partner]
    E --> F[Jawaban AI disimpan ke ai_chat_logs]
    F --> G[Jawaban ditampilkan ke user]
```

## 8. Ringkasan Struktur Navigasi per Role

### Guest

- landing page
- login modal
- register modal
- AI widget

### User

- dashboard tunggal
- create request
- detail request dan pilih merchant
- running orders
- pembayaran DP / pelunasan
- AI widget

### Merchant

- request terbaru
- penawaran saya
- order masuk
- history

### Admin

- dashboard monitoring
- verifikasi merchant
