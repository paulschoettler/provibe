export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      announcement_messages: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          is_active: boolean
          link_url: string | null
          locale: string
          message: string
          position: number
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          locale?: string
          message: string
          position?: number
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          locale?: string
          message?: string
          position?: number
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_role: string | null
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          ip: unknown
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          ip?: unknown
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_role?: string | null
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          ip?: unknown
          user_agent?: string | null
        }
        Relationships: []
      }
      automation_runs: {
        Row: {
          automation_key: string
          created_at: string
          email: string
          error: string | null
          id: string
          scheduled_for: string
          sent_at: string | null
          skip_reason: string | null
          status: string
          target_id: string
          target_type: string
          token_hash: string | null
        }
        Insert: {
          automation_key: string
          created_at?: string
          email: string
          error?: string | null
          id?: string
          scheduled_for: string
          sent_at?: string | null
          skip_reason?: string | null
          status?: string
          target_id: string
          target_type: string
          token_hash?: string | null
        }
        Update: {
          automation_key?: string
          created_at?: string
          email?: string
          error?: string | null
          id?: string
          scheduled_for?: string
          sent_at?: string | null
          skip_reason?: string | null
          status?: string
          target_id?: string
          target_type?: string
          token_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_key_fkey"
            columns: ["automation_key"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["key"]
          },
        ]
      }
      automations: {
        Row: {
          config: Json
          is_enabled: boolean
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          config?: Json
          is_enabled?: boolean
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          config?: Json
          is_enabled?: boolean
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      b2b_applications: {
        Row: {
          company_name: string
          created_at: string
          customer_id: string
          id: string
          message: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["b2b_status"]
          trade_register: string | null
          vat_id: string | null
        }
        Insert: {
          company_name: string
          created_at?: string
          customer_id: string
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["b2b_status"]
          trade_register?: string | null
          vat_id?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          customer_id?: string
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["b2b_status"]
          trade_register?: string | null
          vat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "b2b_applications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post_translations: {
        Row: {
          body_html: string | null
          excerpt: string | null
          locale: string
          post_id: string
          seo_description: string | null
          seo_title: string | null
          title: string
        }
        Insert: {
          body_html?: string | null
          excerpt?: string | null
          locale?: string
          post_id: string
          seo_description?: string | null
          seo_title?: string | null
          title: string
        }
        Update: {
          body_html?: string | null
          excerpt?: string | null
          locale?: string
          post_id?: string
          seo_description?: string | null
          seo_title?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_translations_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_name: string | null
          blog_handle: string
          cover_image_path: string | null
          created_at: string
          handle: string
          id: string
          published_at: string | null
          status: Database["public"]["Enums"]["publish_status"]
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          blog_handle?: string
          cover_image_path?: string | null
          created_at?: string
          handle: string
          id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["publish_status"]
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          blog_handle?: string
          cover_image_path?: string | null
          created_at?: string
          handle?: string
          id?: string
          published_at?: string | null
          status?: Database["public"]["Enums"]["publish_status"]
          updated_at?: string
        }
        Relationships: []
      }
      bundle_components: {
        Row: {
          bundle_variant_id: string
          component_variant_id: string
          quantity: number
        }
        Insert: {
          bundle_variant_id: string
          component_variant_id: string
          quantity: number
        }
        Update: {
          bundle_variant_id?: string
          component_variant_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "bundle_components_bundle_variant_id_fkey"
            columns: ["bundle_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_components_component_variant_id_fkey"
            columns: ["component_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          bounced_at: string | null
          campaign_id: string
          clicked_at: string | null
          complained_at: string | null
          contact_id: string
          created_at: string
          delivered_at: string | null
          email: string
          error: string | null
          opened_at: string | null
          provider_message_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          unsubscribed_at: string | null
        }
        Insert: {
          bounced_at?: string | null
          campaign_id: string
          clicked_at?: string | null
          complained_at?: string | null
          contact_id: string
          created_at?: string
          delivered_at?: string | null
          email: string
          error?: string | null
          opened_at?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          unsubscribed_at?: string | null
        }
        Update: {
          bounced_at?: string | null
          campaign_id?: string
          clicked_at?: string | null
          complained_at?: string | null
          contact_id?: string
          created_at?: string
          delivered_at?: string | null
          email?: string
          error?: string | null
          opened_at?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "newsletter_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "newsletter_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          added_at: string
          cart_id: string
          id: string
          is_subscription: boolean
          quantity: number
          subscription_interval_weeks: number | null
          variant_id: string
        }
        Insert: {
          added_at?: string
          cart_id: string
          id?: string
          is_subscription?: boolean
          quantity: number
          subscription_interval_weeks?: number | null
          variant_id: string
        }
        Update: {
          added_at?: string
          cart_id?: string
          id?: string
          is_subscription?: boolean
          quantity?: number
          subscription_interval_weeks?: number | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          abandoned_email_sent_at: string | null
          attribution: Json
          converted_order_id: string | null
          created_at: string
          currency: string
          customer_id: string | null
          discount_code_id: string | null
          email: string | null
          id: string
          last_activity_at: string
          locale: string
          note: string | null
          status: Database["public"]["Enums"]["cart_status"]
          token: string
          updated_at: string
        }
        Insert: {
          abandoned_email_sent_at?: string | null
          attribution?: Json
          converted_order_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount_code_id?: string | null
          email?: string | null
          id?: string
          last_activity_at?: string
          locale?: string
          note?: string | null
          status?: Database["public"]["Enums"]["cart_status"]
          token?: string
          updated_at?: string
        }
        Update: {
          abandoned_email_sent_at?: string | null
          attribution?: Json
          converted_order_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          discount_code_id?: string | null
          email?: string | null
          id?: string
          last_activity_at?: string
          locale?: string
          note?: string | null
          status?: Database["public"]["Enums"]["cart_status"]
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_converted_order_fk"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_sessions: {
        Row: {
          amounts: Json | null
          attribution: Json
          billing_address: Json | null
          cart_id: string
          completed_at: string | null
          create_account: boolean
          created_at: string
          customer_id: string | null
          discount_code: string | null
          email: string | null
          expires_at: string
          id: string
          legal_versions: Json | null
          marketing_opt_in: boolean
          order_id: string | null
          payment_intent_id: string | null
          payment_provider: string
          phone: string | null
          shipping_address: Json | null
          shipping_method: Json | null
          shipping_rate_id: string | null
          status: Database["public"]["Enums"]["checkout_status"]
          updated_at: string
        }
        Insert: {
          amounts?: Json | null
          attribution?: Json
          billing_address?: Json | null
          cart_id: string
          completed_at?: string | null
          create_account?: boolean
          created_at?: string
          customer_id?: string | null
          discount_code?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          legal_versions?: Json | null
          marketing_opt_in?: boolean
          order_id?: string | null
          payment_intent_id?: string | null
          payment_provider?: string
          phone?: string | null
          shipping_address?: Json | null
          shipping_method?: Json | null
          shipping_rate_id?: string | null
          status?: Database["public"]["Enums"]["checkout_status"]
          updated_at?: string
        }
        Update: {
          amounts?: Json | null
          attribution?: Json
          billing_address?: Json | null
          cart_id?: string
          completed_at?: string | null
          create_account?: boolean
          created_at?: string
          customer_id?: string | null
          discount_code?: string | null
          email?: string | null
          expires_at?: string
          id?: string
          legal_versions?: Json | null
          marketing_opt_in?: boolean
          order_id?: string | null
          payment_intent_id?: string | null
          payment_provider?: string
          phone?: string | null
          shipping_address?: Json | null
          shipping_method?: Json | null
          shipping_rate_id?: string | null
          status?: Database["public"]["Enums"]["checkout_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_sessions_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_order_fk"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkout_sessions_shipping_rate_id_fkey"
            columns: ["shipping_rate_id"]
            isOneToOne: false
            referencedRelation: "shipping_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_products: {
        Row: {
          collection_id: string
          position: number
          product_id: string
        }
        Insert: {
          collection_id: string
          position?: number
          product_id: string
        }
        Update: {
          collection_id?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_translations: {
        Row: {
          collection_id: string
          description_html: string | null
          locale: string
          seo_description: string | null
          seo_title: string | null
          title: string
        }
        Insert: {
          collection_id: string
          description_html?: string | null
          locale?: string
          seo_description?: string | null
          seo_title?: string | null
          title: string
        }
        Update: {
          collection_id?: string
          description_html?: string | null
          locale?: string
          seo_description?: string | null
          seo_title?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_translations_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          handle: string
          id: string
          image_path: string | null
          kind: string
          position: number
          rules: Json
          shopify_collection_id: number | null
          sort_key: string
          status: Database["public"]["Enums"]["publish_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          handle: string
          id?: string
          image_path?: string | null
          kind?: string
          position?: number
          rules?: Json
          shopify_collection_id?: number | null
          sort_key?: string
          status?: Database["public"]["Enums"]["publish_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          handle?: string
          id?: string
          image_path?: string | null
          kind?: string
          position?: number
          rules?: Json
          shopify_collection_id?: number | null
          sort_key?: string
          status?: Database["public"]["Enums"]["publish_status"]
          updated_at?: string
        }
        Relationships: []
      }
      consent_logs: {
        Row: {
          action: string
          anonymous_id: string
          banner_version: string
          categories: Json
          created_at: string
          customer_id: string | null
          id: number
          ip_hash: string | null
          page_url: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          anonymous_id: string
          banner_version: string
          categories: Json
          created_at?: string
          customer_id?: string | null
          id?: never
          ip_hash?: string | null
          page_url?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          anonymous_id?: string
          banner_version?: string
          categories?: Json
          created_at?: string
          customer_id?: string | null
          id?: never
          ip_hash?: string | null
          page_url?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_hash: string | null
          message: string
          name: string
          phone: string | null
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_hash?: string | null
          message: string
          name: string
          phone?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_hash?: string | null
          message?: string
          name?: string
          phone?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customer_addresses: {
        Row: {
          address_addition: string | null
          city: string
          company: string | null
          country_code: string
          created_at: string
          customer_id: string
          first_name: string
          house_number: string | null
          id: string
          is_default_billing: boolean
          is_default_shipping: boolean
          label: string | null
          last_name: string
          phone: string | null
          postal_code: string
          street: string
          updated_at: string
        }
        Insert: {
          address_addition?: string | null
          city: string
          company?: string | null
          country_code?: string
          created_at?: string
          customer_id: string
          first_name: string
          house_number?: string | null
          id?: string
          is_default_billing?: boolean
          is_default_shipping?: boolean
          label?: string | null
          last_name: string
          phone?: string | null
          postal_code: string
          street: string
          updated_at?: string
        }
        Update: {
          address_addition?: string | null
          city?: string
          company?: string | null
          country_code?: string
          created_at?: string
          customer_id?: string
          first_name?: string
          house_number?: string | null
          id?: string
          is_default_billing?: boolean
          is_default_shipping?: boolean
          label?: string | null
          last_name?: string
          phone?: string | null
          postal_code?: string
          street?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_events: {
        Row: {
          created_at: string
          customer_id: string
          data: Json
          id: number
          kind: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          data?: Json
          id?: never
          kind: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          data?: Json
          id?: never
          kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          author_user_id: string | null
          body: string
          created_at: string
          customer_id: string
          id: string
        }
        Insert: {
          author_user_id?: string | null
          body: string
          created_at?: string
          customer_id: string
          id?: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          created_at?: string
          customer_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payment_methods: {
        Row: {
          brand: string | null
          created_at: string
          customer_id: string
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean
          last4: string | null
          stripe_customer_id: string
          stripe_payment_method_id: string
          type: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          customer_id: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          stripe_customer_id: string
          stripe_payment_method_id: string
          type: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          customer_id?: string
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean
          last4?: string | null
          stripe_customer_id?: string
          stripe_payment_method_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_payment_methods_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          acquisition_details: Json
          acquisition_source: string | null
          activation_email_sent_at: string | null
          anonymized_at: string | null
          auth_user_id: string | null
          b2b_status: Database["public"]["Enums"]["b2b_status"]
          blocked_at: string | null
          blocked_by: string | null
          blocked_reason: string | null
          company_name: string | null
          created_at: string
          customer_type: Database["public"]["Enums"]["customer_type"]
          email: string
          first_name: string | null
          first_order_at: string | null
          id: string
          last_name: string | null
          last_order_at: string | null
          locale: string
          orders_count: number
          payment_terms: string | null
          phone: string | null
          price_list_id: string | null
          shopify_customer_id: number | null
          stripe_customer_id: string | null
          tags: string[]
          total_spent_cents: number
          updated_at: string
          vat_id: string | null
        }
        Insert: {
          acquisition_details?: Json
          acquisition_source?: string | null
          activation_email_sent_at?: string | null
          anonymized_at?: string | null
          auth_user_id?: string | null
          b2b_status?: Database["public"]["Enums"]["b2b_status"]
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          company_name?: string | null
          created_at?: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          email: string
          first_name?: string | null
          first_order_at?: string | null
          id?: string
          last_name?: string | null
          last_order_at?: string | null
          locale?: string
          orders_count?: number
          payment_terms?: string | null
          phone?: string | null
          price_list_id?: string | null
          shopify_customer_id?: number | null
          stripe_customer_id?: string | null
          tags?: string[]
          total_spent_cents?: number
          updated_at?: string
          vat_id?: string | null
        }
        Update: {
          acquisition_details?: Json
          acquisition_source?: string | null
          activation_email_sent_at?: string | null
          anonymized_at?: string | null
          auth_user_id?: string | null
          b2b_status?: Database["public"]["Enums"]["b2b_status"]
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string | null
          company_name?: string | null
          created_at?: string
          customer_type?: Database["public"]["Enums"]["customer_type"]
          email?: string
          first_name?: string | null
          first_order_at?: string | null
          id?: string
          last_name?: string | null
          last_order_at?: string | null
          locale?: string
          orders_count?: number
          payment_terms?: string | null
          phone?: string | null
          price_list_id?: string | null
          shopify_customer_id?: number | null
          stripe_customer_id?: string | null
          tags?: string[]
          total_spent_cents?: number
          updated_at?: string
          vat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_codes: {
        Row: {
          applies_to: Json
          code: string
          combinable: boolean
          created_at: string
          created_by: string | null
          customer_type: Database["public"]["Enums"]["customer_type"] | null
          ends_at: string | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["discount_kind"]
          min_subtotal_cents: number
          shopify_discount_id: string | null
          starts_at: string | null
          title: string | null
          updated_at: string
          usage_count: number
          usage_limit: number | null
          usage_limit_per_customer: number | null
          value: number
        }
        Insert: {
          applies_to?: Json
          code: string
          combinable?: boolean
          created_at?: string
          created_by?: string | null
          customer_type?: Database["public"]["Enums"]["customer_type"] | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["discount_kind"]
          min_subtotal_cents?: number
          shopify_discount_id?: string | null
          starts_at?: string | null
          title?: string | null
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          usage_limit_per_customer?: number | null
          value?: number
        }
        Update: {
          applies_to?: Json
          code?: string
          combinable?: boolean
          created_at?: string
          created_by?: string | null
          customer_type?: Database["public"]["Enums"]["customer_type"] | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["discount_kind"]
          min_subtotal_cents?: number
          shopify_discount_id?: string | null
          starts_at?: string | null
          title?: string | null
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          usage_limit_per_customer?: number | null
          value?: number
        }
        Relationships: []
      }
      discount_redemptions: {
        Row: {
          amount_cents: number
          created_at: string
          customer_id: string | null
          discount_code_id: string
          email: string
          id: string
          order_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          customer_id?: string | null
          discount_code_id: string
          email: string
          id?: string
          order_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          customer_id?: string | null
          discount_code_id?: string
          email?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discount_redemptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_redemptions_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_redemptions_order_fk"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_messages: {
        Row: {
          campaign_id: string | null
          category: Database["public"]["Enums"]["email_category"]
          clicked_at: string | null
          created_at: string
          customer_id: string | null
          delivered_at: string | null
          error: string | null
          from_email: string
          id: string
          metadata: Json
          opened_at: string | null
          order_id: string | null
          provider: string
          provider_message_id: string | null
          reply_to: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string
          template: string
          to_email: string
        }
        Insert: {
          campaign_id?: string | null
          category?: Database["public"]["Enums"]["email_category"]
          clicked_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          error?: string | null
          from_email: string
          id?: string
          metadata?: Json
          opened_at?: string | null
          order_id?: string | null
          provider?: string
          provider_message_id?: string | null
          reply_to?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject: string
          template: string
          to_email: string
        }
        Update: {
          campaign_id?: string | null
          category?: Database["public"]["Enums"]["email_category"]
          clicked_at?: string | null
          created_at?: string
          customer_id?: string | null
          delivered_at?: string | null
          error?: string | null
          from_email?: string
          id?: string
          metadata?: Json
          opened_at?: string | null
          order_id?: string | null
          provider?: string
          provider_message_id?: string | null
          reply_to?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string
          template?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_messages_campaign_fk"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "newsletter_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      email_suppressions: {
        Row: {
          created_at: string
          email: string
          reason: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          reason: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          reason?: string
          source?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          category: Database["public"]["Enums"]["email_category"]
          description: string | null
          is_enabled: boolean
          key: string
          name: string
          preview_props: Json
          subject_template: string
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["email_category"]
          description?: string | null
          is_enabled?: boolean
          key: string
          name: string
          preview_props?: Json
          subject_template: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["email_category"]
          description?: string | null
          is_enabled?: boolean
          key?: string
          name?: string
          preview_props?: Json
          subject_template?: string
          updated_at?: string
        }
        Relationships: []
      }
      homepage_modules: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_enabled: boolean
          kind: string
          locale: string
          position: number
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          kind: string
          locale?: string
          position?: number
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          kind?: string
          locale?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      import_run_items: {
        Row: {
          action: string
          before: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: number
          run_id: string
          source_line: number | null
        }
        Insert: {
          action: string
          before?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: never
          run_id: string
          source_line?: number | null
        }
        Update: {
          action?: string
          before?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: never
          run_id?: string
          source_line?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_run_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_runs: {
        Row: {
          created_at: string
          created_count: number
          error_count: number
          extra_files: Json
          file_name: string
          file_sha256: string
          finished_at: string | null
          id: string
          kind: string
          options: Json
          result: Json
          rollback_result: Json | null
          rolled_back_at: string | null
          rows_total: number
          skipped_count: number
          started_at: string
          started_by: string | null
          status: string
          unchanged_count: number
          updated_at: string
          updated_count: number
        }
        Insert: {
          created_at?: string
          created_count?: number
          error_count?: number
          extra_files?: Json
          file_name: string
          file_sha256: string
          finished_at?: string | null
          id?: string
          kind: string
          options?: Json
          result?: Json
          rollback_result?: Json | null
          rolled_back_at?: string | null
          rows_total?: number
          skipped_count?: number
          started_at?: string
          started_by?: string | null
          status?: string
          unchanged_count?: number
          updated_at?: string
          updated_count?: number
        }
        Update: {
          created_at?: string
          created_count?: number
          error_count?: number
          extra_files?: Json
          file_name?: string
          file_sha256?: string
          finished_at?: string | null
          id?: string
          kind?: string
          options?: Json
          result?: Json
          rollback_result?: Json | null
          rolled_back_at?: string | null
          rows_total?: number
          skipped_count?: number
          started_at?: string
          started_by?: string | null
          status?: string
          unchanged_count?: number
          updated_at?: string
          updated_count?: number
        }
        Relationships: []
      }
      inventory_levels: {
        Row: {
          allow_backorder: boolean
          low_stock_threshold: number
          on_hand: number
          reserved: number
          track_inventory: boolean
          updated_at: string
          variant_id: string
        }
        Insert: {
          allow_backorder?: boolean
          low_stock_threshold?: number
          on_hand?: number
          reserved?: number
          track_inventory?: boolean
          updated_at?: string
          variant_id: string
        }
        Update: {
          allow_backorder?: boolean
          low_stock_threshold?: number
          on_hand?: number
          reserved?: number
          track_inventory?: boolean
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_levels_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: true
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          delta: number
          id: number
          note: string | null
          reason: Database["public"]["Enums"]["inventory_reason"]
          reference_id: string | null
          reference_type: string | null
          variant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta: number
          id?: never
          note?: string | null
          reason: Database["public"]["Enums"]["inventory_reason"]
          reference_id?: string | null
          reference_type?: string | null
          variant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: never
          note?: string | null
          reason?: Database["public"]["Enums"]["inventory_reason"]
          reference_id?: string | null
          reference_type?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_reservations: {
        Row: {
          bundle_variant_id: string | null
          checkout_session_id: string
          created_at: string
          expires_at: string
          id: string
          quantity: number
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
          variant_id: string
        }
        Insert: {
          bundle_variant_id?: string | null
          checkout_session_id: string
          created_at?: string
          expires_at: string
          id?: string
          quantity: number
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
          variant_id: string
        }
        Update: {
          bundle_variant_id?: string | null
          checkout_session_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          quantity?: number
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_bundle_variant_id_fkey"
            columns: ["bundle_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_session_fk"
            columns: ["checkout_session_id"]
            isOneToOne: false
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempts: number
          created_at: string
          finished_at: string | null
          id: string
          idempotency_key: string | null
          kind: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          order_id: string | null
          payload: Json
          priority: number
          run_at: string
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          kind: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          order_id?: string | null
          payload?: Json
          priority?: number
          run_at?: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          idempotency_key?: string | null
          kind?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          order_id?: string | null
          payload?: Json
          priority?: number
          run_at?: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          lead_id: string
        }
        Insert: {
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          lead_id: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          attribution: Json
          company: string | null
          contact_name: string
          created_at: string
          customer_id: string | null
          email: string
          id: string
          ip_hash: string | null
          kind: string
          location_type: string | null
          message: string | null
          phone: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attribution?: Json
          company?: string | null
          contact_name: string
          created_at?: string
          customer_id?: string | null
          email: string
          id?: string
          ip_hash?: string | null
          kind?: string
          location_type?: string | null
          message?: string | null
          phone?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attribution?: Json
          company?: string | null
          contact_name?: string
          created_at?: string
          customer_id?: string | null
          email?: string
          id?: string
          ip_hash?: string | null
          kind?: string
          location_type?: string | null
          message?: string | null
          phone?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_document_versions: {
        Row: {
          body_html: string
          change_note: string | null
          created_at: string
          created_by: string | null
          document_id: string
          effective_from: string | null
          id: string
          locale: string
          published_at: string | null
          published_by: string | null
          status: Database["public"]["Enums"]["publish_status"]
          title: string
          version: number
        }
        Insert: {
          body_html: string
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          document_id: string
          effective_from?: string | null
          id?: string
          locale?: string
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["publish_status"]
          title: string
          version: number
        }
        Update: {
          body_html?: string
          change_note?: string | null
          created_at?: string
          created_by?: string | null
          document_id?: string
          effective_from?: string | null
          id?: string
          locale?: string
          published_at?: string | null
          published_by?: string | null
          status?: Database["public"]["Enums"]["publish_status"]
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "legal_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["legal_document_kind"]
          path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["legal_document_kind"]
          path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["legal_document_kind"]
          path?: string
          updated_at?: string
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          alt: Json
          bucket: string
          bytes: number | null
          created_at: string
          created_by: string | null
          focal_x: number | null
          focal_y: number | null
          height: number | null
          id: string
          mime_type: string | null
          path: string
          source_url: string | null
          tags: string[]
          width: number | null
        }
        Insert: {
          alt?: Json
          bucket?: string
          bytes?: number | null
          created_at?: string
          created_by?: string | null
          focal_x?: number | null
          focal_y?: number | null
          height?: number | null
          id?: string
          mime_type?: string | null
          path: string
          source_url?: string | null
          tags?: string[]
          width?: number | null
        }
        Update: {
          alt?: Json
          bucket?: string
          bytes?: number | null
          created_at?: string
          created_by?: string | null
          focal_x?: number | null
          focal_y?: number | null
          height?: number | null
          id?: string
          mime_type?: string | null
          path?: string
          source_url?: string | null
          tags?: string[]
          width?: number | null
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          id: string
          is_external: boolean
          label: Json
          menu_id: string
          opens_new_tab: boolean
          parent_id: string | null
          position: number
          url: string
        }
        Insert: {
          id?: string
          is_external?: boolean
          label: Json
          menu_id: string
          opens_new_tab?: boolean
          parent_id?: string | null
          position?: number
          url: string
        }
        Update: {
          id?: string
          is_external?: boolean
          label?: Json
          menu_id?: string
          opens_new_tab?: boolean
          parent_id?: string | null
          position?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          handle: string
          id: string
          name: string
        }
        Insert: {
          handle: string
          id?: string
          name: string
        }
        Update: {
          handle?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      newsletter_campaigns: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          from_email: string | null
          html_cache: string | null
          id: string
          name: string
          preheader: string | null
          recipients_count: number
          reply_to: string | null
          scheduled_at: string | null
          segment_id: string | null
          segment_snapshot: Json | null
          sent_at: string | null
          stats: Json
          status: Database["public"]["Enums"]["campaign_status"]
          subject: string
          test_sent_at: string | null
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          from_email?: string | null
          html_cache?: string | null
          id?: string
          name: string
          preheader?: string | null
          recipients_count?: number
          reply_to?: string | null
          scheduled_at?: string | null
          segment_id?: string | null
          segment_snapshot?: Json | null
          sent_at?: string | null
          stats?: Json
          status?: Database["public"]["Enums"]["campaign_status"]
          subject: string
          test_sent_at?: string | null
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          from_email?: string | null
          html_cache?: string | null
          id?: string
          name?: string
          preheader?: string | null
          recipients_count?: number
          reply_to?: string | null
          scheduled_at?: string | null
          segment_id?: string | null
          segment_snapshot?: Json | null
          sent_at?: string | null
          stats?: Json
          status?: Database["public"]["Enums"]["campaign_status"]
          subject?: string
          test_sent_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_campaigns_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "saved_segments"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_contacts: {
        Row: {
          confirm_ip: unknown
          confirm_token_hash: string | null
          confirm_user_agent: string | null
          confirmed_at: string | null
          consent_text: string | null
          consent_version: string | null
          created_at: string
          customer_id: string | null
          email: string
          first_name: string | null
          id: string
          imported_consent_at: string | null
          opt_in_sent_at: string | null
          resend_contact_id: string | null
          source: string
          status: Database["public"]["Enums"]["newsletter_status"]
          tags: string[]
          unsubscribe_reason: string | null
          unsubscribe_token: string
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          confirm_ip?: unknown
          confirm_token_hash?: string | null
          confirm_user_agent?: string | null
          confirmed_at?: string | null
          consent_text?: string | null
          consent_version?: string | null
          created_at?: string
          customer_id?: string | null
          email: string
          first_name?: string | null
          id?: string
          imported_consent_at?: string | null
          opt_in_sent_at?: string | null
          resend_contact_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["newsletter_status"]
          tags?: string[]
          unsubscribe_reason?: string | null
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          confirm_ip?: unknown
          confirm_token_hash?: string | null
          confirm_user_agent?: string | null
          confirmed_at?: string | null
          consent_text?: string | null
          consent_version?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string
          first_name?: string | null
          id?: string
          imported_consent_at?: string | null
          opt_in_sent_at?: string | null
          resend_contact_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["newsletter_status"]
          tags?: string[]
          unsubscribe_reason?: string | null
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          actor_user_id: string | null
          created_at: string
          data: Json
          id: number
          kind: string
          message: string | null
          order_id: string
          visible_to_customer: boolean
        }
        Insert: {
          actor_user_id?: string | null
          created_at?: string
          data?: Json
          id?: never
          kind: string
          message?: string | null
          order_id: string
          visible_to_customer?: boolean
        }
        Update: {
          actor_user_id?: string | null
          created_at?: string
          data?: Json
          id?: never
          kind?: string
          message?: string | null
          order_id?: string
          visible_to_customer?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          base_price_text: string | null
          components: Json | null
          discount_cents: number
          fulfilled_quantity: number
          id: string
          image_path: string | null
          line_total_cents: number
          order_id: string
          position: number
          product_handle: string | null
          product_id: string | null
          product_title: string
          quantity: number
          refunded_quantity: number
          sku: string | null
          tax_class: string
          tax_rate_bp: number
          unit_count: number
          unit_deposit_cents: number
          unit_price_cents: number
          variant_id: string | null
          variant_title: string | null
          weight_grams: number | null
        }
        Insert: {
          base_price_text?: string | null
          components?: Json | null
          discount_cents?: number
          fulfilled_quantity?: number
          id?: string
          image_path?: string | null
          line_total_cents: number
          order_id: string
          position?: number
          product_handle?: string | null
          product_id?: string | null
          product_title: string
          quantity: number
          refunded_quantity?: number
          sku?: string | null
          tax_class?: string
          tax_rate_bp?: number
          unit_count?: number
          unit_deposit_cents?: number
          unit_price_cents: number
          variant_id?: string | null
          variant_title?: string | null
          weight_grams?: number | null
        }
        Update: {
          base_price_text?: string | null
          components?: Json | null
          discount_cents?: number
          fulfilled_quantity?: number
          id?: string
          image_path?: string | null
          line_total_cents?: number
          order_id?: string
          position?: number
          product_handle?: string | null
          product_id?: string | null
          product_title?: string
          quantity?: number
          refunded_quantity?: number
          sku?: string | null
          tax_class?: string
          tax_rate_bp?: number
          unit_count?: number
          unit_deposit_cents?: number
          unit_price_cents?: number
          variant_id?: string | null
          variant_title?: string | null
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes: {
        Row: {
          author_user_id: string | null
          body: string
          created_at: string
          id: string
          order_id: string
        }
        Insert: {
          author_user_id?: string | null
          body: string
          created_at?: string
          id?: string
          order_id: string
        }
        Update: {
          author_user_id?: string | null
          body?: string
          created_at?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          attribution: Json
          billing_address: Json | null
          cancel_reason: string | null
          cancelled_at: string | null
          cart_id: string | null
          checkout_session_id: string | null
          created_at: string
          currency: string
          customer_id: string | null
          customer_note: string | null
          delivered_at: string | null
          deposit_cents: number
          discount_cents: number
          discount_code: string | null
          discount_code_id: string | null
          email: string
          fulfillment_status: Database["public"]["Enums"]["fulfillment_status"]
          id: string
          invoice_error: string | null
          invoice_number: string | null
          invoice_pdf_path: string | null
          invoice_status: Database["public"]["Enums"]["invoice_status"]
          is_test: boolean
          legal_versions: Json
          lexware_contact_id: string | null
          lexware_invoice_id: string | null
          locale: string
          order_number: string
          paid_at: string | null
          payment_intent_id: string | null
          payment_method_type: string | null
          payment_provider: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          phone: string | null
          placed_at: string
          review_request_sent_at: string | null
          shipped_at: string | null
          shipping_address: Json
          shipping_cents: number
          shipping_rate_id: string | null
          shipping_rate_name: string | null
          shopify_order_id: number | null
          shopify_order_name: string | null
          source: string
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          tax_cents: number
          tax_lines: Json
          total_cents: number
          updated_at: string
        }
        Insert: {
          attribution?: Json
          billing_address?: Json | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cart_id?: string | null
          checkout_session_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_note?: string | null
          delivered_at?: string | null
          deposit_cents?: number
          discount_cents?: number
          discount_code?: string | null
          discount_code_id?: string | null
          email: string
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          id?: string
          invoice_error?: string | null
          invoice_number?: string | null
          invoice_pdf_path?: string | null
          invoice_status?: Database["public"]["Enums"]["invoice_status"]
          is_test?: boolean
          legal_versions?: Json
          lexware_contact_id?: string | null
          lexware_invoice_id?: string | null
          locale?: string
          order_number?: string
          paid_at?: string | null
          payment_intent_id?: string | null
          payment_method_type?: string | null
          payment_provider?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string | null
          placed_at?: string
          review_request_sent_at?: string | null
          shipped_at?: string | null
          shipping_address: Json
          shipping_cents?: number
          shipping_rate_id?: string | null
          shipping_rate_name?: string | null
          shopify_order_id?: number | null
          shopify_order_name?: string | null
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          tax_cents?: number
          tax_lines?: Json
          total_cents?: number
          updated_at?: string
        }
        Update: {
          attribution?: Json
          billing_address?: Json | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cart_id?: string | null
          checkout_session_id?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_note?: string | null
          delivered_at?: string | null
          deposit_cents?: number
          discount_cents?: number
          discount_code?: string | null
          discount_code_id?: string | null
          email?: string
          fulfillment_status?: Database["public"]["Enums"]["fulfillment_status"]
          id?: string
          invoice_error?: string | null
          invoice_number?: string | null
          invoice_pdf_path?: string | null
          invoice_status?: Database["public"]["Enums"]["invoice_status"]
          is_test?: boolean
          legal_versions?: Json
          lexware_contact_id?: string | null
          lexware_invoice_id?: string | null
          locale?: string
          order_number?: string
          paid_at?: string | null
          payment_intent_id?: string | null
          payment_method_type?: string | null
          payment_provider?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          phone?: string | null
          placed_at?: string
          review_request_sent_at?: string | null
          shipped_at?: string | null
          shipping_address?: Json
          shipping_cents?: number
          shipping_rate_id?: string | null
          shipping_rate_name?: string | null
          shopify_order_id?: number | null
          shopify_order_name?: string | null
          source?: string
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          tax_cents?: number
          tax_lines?: Json
          total_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_checkout_session_id_fkey"
            columns: ["checkout_session_id"]
            isOneToOne: true
            referencedRelation: "checkout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_discount_code_id_fkey"
            columns: ["discount_code_id"]
            isOneToOne: false
            referencedRelation: "discount_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shipping_rate_id_fkey"
            columns: ["shipping_rate_id"]
            isOneToOne: false
            referencedRelation: "shipping_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      page_translations: {
        Row: {
          blocks: Json
          body_html: string | null
          locale: string
          og_image_path: string | null
          page_id: string
          seo_description: string | null
          seo_title: string | null
          title: string
        }
        Insert: {
          blocks?: Json
          body_html?: string | null
          locale?: string
          og_image_path?: string | null
          page_id: string
          seo_description?: string | null
          seo_title?: string | null
          title: string
        }
        Update: {
          blocks?: Json
          body_html?: string | null
          locale?: string
          og_image_path?: string | null
          page_id?: string
          seo_description?: string | null
          seo_title?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_translations_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          created_at: string
          handle: string
          id: string
          noindex: boolean
          position: number
          published_at: string | null
          show_in_sitemap: boolean
          status: Database["public"]["Enums"]["publish_status"]
          template: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          handle: string
          id?: string
          noindex?: boolean
          position?: number
          published_at?: string | null
          show_in_sitemap?: boolean
          status?: Database["public"]["Enums"]["publish_status"]
          template?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          handle?: string
          id?: string
          noindex?: boolean
          position?: number
          published_at?: string | null
          show_in_sitemap?: boolean
          status?: Database["public"]["Enums"]["publish_status"]
          template?: string
          updated_at?: string
        }
        Relationships: []
      }
      price_history: {
        Row: {
          changed_by: string | null
          compare_at_cents: number | null
          id: number
          price_cents: number
          source: string
          valid_from: string
          valid_to: string | null
          variant_id: string
        }
        Insert: {
          changed_by?: string | null
          compare_at_cents?: number | null
          id?: never
          price_cents: number
          source?: string
          valid_from?: string
          valid_to?: string | null
          variant_id: string
        }
        Update: {
          changed_by?: string | null
          compare_at_cents?: number | null
          id?: never
          price_cents?: number
          source?: string
          valid_from?: string
          valid_to?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_history_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_entries: {
        Row: {
          min_quantity: number
          price_cents: number
          price_list_id: string
          variant_id: string
        }
        Insert: {
          min_quantity?: number
          price_cents: number
          price_list_id: string
          variant_id: string
        }
        Update: {
          min_quantity?: number
          price_cents?: number
          price_list_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_entries_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_entries_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          code: string
          created_at: string
          currency: string
          id: string
          is_default: boolean
          name: string
          prices_include_tax: boolean
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          id?: string
          is_default?: boolean
          name: string
          prices_include_tax?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          id?: string
          is_default?: boolean
          name?: string
          prices_include_tax?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt: Json
          created_at: string
          height: number | null
          id: string
          position: number
          product_id: string
          source_url: string | null
          storage_bucket: string
          storage_path: string
          variant_id: string | null
          width: number | null
        }
        Insert: {
          alt?: Json
          created_at?: string
          height?: number | null
          id?: string
          position?: number
          product_id: string
          source_url?: string | null
          storage_bucket?: string
          storage_path: string
          variant_id?: string | null
          width?: number | null
        }
        Update: {
          alt?: Json
          created_at?: string
          height?: number | null
          id?: string
          position?: number
          product_id?: string
          source_url?: string | null
          storage_bucket?: string
          storage_path?: string
          variant_id?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          id: string
          name: string
          position: number
          product_id: string
          values: string[]
        }
        Insert: {
          id?: string
          name: string
          position?: number
          product_id: string
          values?: string[]
        }
        Update: {
          id?: string
          name?: string
          position?: number
          product_id?: string
          values?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "product_options_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_translations: {
        Row: {
          allergens: string | null
          country_of_origin: string | null
          delivery_time_text: string | null
          description_html: string | null
          faq: Json
          food_business_operator: string | null
          food_name: string | null
          ingredients_html: string | null
          locale: string
          nutrition: Json | null
          og_image_path: string | null
          product_id: string
          seo_description: string | null
          seo_title: string | null
          storage_instructions: string | null
          subtitle: string | null
          title: string
        }
        Insert: {
          allergens?: string | null
          country_of_origin?: string | null
          delivery_time_text?: string | null
          description_html?: string | null
          faq?: Json
          food_business_operator?: string | null
          food_name?: string | null
          ingredients_html?: string | null
          locale?: string
          nutrition?: Json | null
          og_image_path?: string | null
          product_id: string
          seo_description?: string | null
          seo_title?: string | null
          storage_instructions?: string | null
          subtitle?: string | null
          title: string
        }
        Update: {
          allergens?: string | null
          country_of_origin?: string | null
          delivery_time_text?: string | null
          description_html?: string | null
          faq?: Json
          food_business_operator?: string | null
          food_name?: string | null
          ingredients_html?: string | null
          locale?: string
          nutrition?: Json | null
          og_image_path?: string | null
          product_id?: string
          seo_description?: string | null
          seo_title?: string | null
          storage_instructions?: string | null
          subtitle?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_translations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          compare_at_cents: number | null
          compare_at_kind: Database["public"]["Enums"]["compare_at_kind"]
          created_at: string
          gtin: string | null
          id: string
          is_active: boolean
          legacy_sku: string | null
          min_quantity_b2b: number | null
          option_values: Json
          packaging_weight_grams: number
          position: number
          price_cents: number
          product_id: string
          shopify_variant_id: number | null
          sku: string | null
          title: string
          unit_count: number
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          compare_at_cents?: number | null
          compare_at_kind?: Database["public"]["Enums"]["compare_at_kind"]
          created_at?: string
          gtin?: string | null
          id?: string
          is_active?: boolean
          legacy_sku?: string | null
          min_quantity_b2b?: number | null
          option_values?: Json
          packaging_weight_grams?: number
          position?: number
          price_cents: number
          product_id: string
          shopify_variant_id?: number | null
          sku?: string | null
          title: string
          unit_count?: number
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          compare_at_cents?: number | null
          compare_at_kind?: Database["public"]["Enums"]["compare_at_kind"]
          created_at?: string
          gtin?: string | null
          id?: string
          is_active?: boolean
          legacy_sku?: string | null
          min_quantity_b2b?: number | null
          option_values?: Json
          packaging_weight_grams?: number
          position?: number
          price_cents?: number
          product_id?: string
          shopify_variant_id?: number | null
          sku?: string | null
          title?: string
          unit_count?: number
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          attributes: Json
          base_price_measure: Database["public"]["Enums"]["unit_measure"]
          created_at: string
          deposit_cents_per_unit: number
          handle: string
          id: string
          is_food: boolean
          kind: Database["public"]["Enums"]["product_kind"]
          min_quantity_b2b: number | null
          net_content_measure: Database["public"]["Enums"]["unit_measure"]
          net_content_per_unit: number | null
          position: number
          product_type: string | null
          published_at: string | null
          shopify_product_id: number | null
          status: Database["public"]["Enums"]["product_status"]
          tags: string[]
          tax_class: string
          unit_label: string
          updated_at: string
          vendor: string
          weight_grams_per_unit: number | null
        }
        Insert: {
          attributes?: Json
          base_price_measure?: Database["public"]["Enums"]["unit_measure"]
          created_at?: string
          deposit_cents_per_unit?: number
          handle: string
          id?: string
          is_food?: boolean
          kind?: Database["public"]["Enums"]["product_kind"]
          min_quantity_b2b?: number | null
          net_content_measure?: Database["public"]["Enums"]["unit_measure"]
          net_content_per_unit?: number | null
          position?: number
          product_type?: string | null
          published_at?: string | null
          shopify_product_id?: number | null
          status?: Database["public"]["Enums"]["product_status"]
          tags?: string[]
          tax_class?: string
          unit_label?: string
          updated_at?: string
          vendor?: string
          weight_grams_per_unit?: number | null
        }
        Update: {
          attributes?: Json
          base_price_measure?: Database["public"]["Enums"]["unit_measure"]
          created_at?: string
          deposit_cents_per_unit?: number
          handle?: string
          id?: string
          is_food?: boolean
          kind?: Database["public"]["Enums"]["product_kind"]
          min_quantity_b2b?: number | null
          net_content_measure?: Database["public"]["Enums"]["unit_measure"]
          net_content_per_unit?: number | null
          position?: number
          product_type?: string | null
          published_at?: string | null
          shopify_product_id?: number | null
          status?: Database["public"]["Enums"]["product_status"]
          tags?: string[]
          tax_class?: string
          unit_label?: string
          updated_at?: string
          vendor?: string
          weight_grams_per_unit?: number | null
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start?: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      redirects: {
        Row: {
          created_at: string
          from_path: string
          hits: number
          id: string
          is_enabled: boolean
          note: string | null
          status_code: number
          to_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_path: string
          hits?: number
          id?: string
          is_enabled?: boolean
          note?: string | null
          status_code?: number
          to_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_path?: string
          hits?: number
          id?: string
          is_enabled?: boolean
          note?: string | null
          status_code?: number
          to_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          credit_note_number: string | null
          credit_note_pdf_path: string | null
          id: string
          items: Json
          lexware_credit_note_id: string | null
          order_id: string
          provider: string
          provider_refund_id: string | null
          reason: string | null
          restock: boolean
          status: Database["public"]["Enums"]["refund_status"]
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          credit_note_number?: string | null
          credit_note_pdf_path?: string | null
          id?: string
          items?: Json
          lexware_credit_note_id?: string | null
          order_id: string
          provider?: string
          provider_refund_id?: string | null
          reason?: string | null
          restock?: boolean
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          credit_note_number?: string | null
          credit_note_pdf_path?: string | null
          id?: string
          items?: Json
          lexware_credit_note_id?: string | null
          order_id?: string
          provider?: string
          provider_refund_id?: string | null
          reason?: string | null
          restock?: boolean
          status?: Database["public"]["Enums"]["refund_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_name: string
          body: string | null
          created_at: string
          customer_id: string | null
          id: string
          is_verified_purchase: boolean
          moderated_at: string | null
          moderated_by: string | null
          order_id: string | null
          order_item_id: string | null
          product_id: string
          rating: number
          reply_body: string | null
          status: Database["public"]["Enums"]["review_status"]
          title: string | null
          token_hash: string | null
          updated_at: string
        }
        Insert: {
          author_name: string
          body?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          is_verified_purchase?: boolean
          moderated_at?: string | null
          moderated_by?: string | null
          order_id?: string | null
          order_item_id?: string | null
          product_id: string
          rating: number
          reply_body?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          token_hash?: string | null
          updated_at?: string
        }
        Update: {
          author_name?: string
          body?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          is_verified_purchase?: boolean
          moderated_at?: string | null
          moderated_by?: string | null
          order_id?: string | null
          order_item_id?: string | null
          product_id?: string
          rating?: number
          reply_body?: string | null
          status?: Database["public"]["Enums"]["review_status"]
          title?: string | null
          token_hash?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_segments: {
        Row: {
          created_at: string
          created_by: string | null
          definition: Json
          description: string | null
          id: string
          last_count: number | null
          last_counted_at: string | null
          name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          definition: Json
          description?: string | null
          id?: string
          last_count?: number | null
          last_counted_at?: string | null
          name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          definition?: Json
          description?: string | null
          id?: string
          last_count?: number | null
          last_counted_at?: string | null
          name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      shipments: {
        Row: {
          carrier: string
          created_at: string
          created_by: string | null
          customer_notified_at: string | null
          delivered_at: string | null
          dhl_shipment_number: string | null
          id: string
          is_return: boolean
          items: Json
          label_bucket: string | null
          label_path: string | null
          order_id: string
          service: string | null
          shipped_at: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
          weight_grams: number | null
        }
        Insert: {
          carrier?: string
          created_at?: string
          created_by?: string | null
          customer_notified_at?: string | null
          delivered_at?: string | null
          dhl_shipment_number?: string | null
          id?: string
          is_return?: boolean
          items?: Json
          label_bucket?: string | null
          label_path?: string | null
          order_id: string
          service?: string | null
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          weight_grams?: number | null
        }
        Update: {
          carrier?: string
          created_at?: string
          created_by?: string | null
          customer_notified_at?: string | null
          delivered_at?: string | null
          dhl_shipment_number?: string | null
          id?: string
          is_return?: boolean
          items?: Json
          label_bucket?: string | null
          label_path?: string | null
          order_id?: string
          service?: string | null
          shipped_at?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_rates: {
        Row: {
          carrier: string
          created_at: string
          delivery_time_text: string | null
          description: string | null
          free_above_subtotal_cents: number | null
          id: string
          is_enabled: boolean
          max_subtotal_cents: number | null
          max_weight_grams: number | null
          min_subtotal_cents: number
          min_weight_grams: number
          name: string
          position: number
          price_cents: number
          service: string
          tax_class: string
          updated_at: string
          zone_id: string
        }
        Insert: {
          carrier?: string
          created_at?: string
          delivery_time_text?: string | null
          description?: string | null
          free_above_subtotal_cents?: number | null
          id?: string
          is_enabled?: boolean
          max_subtotal_cents?: number | null
          max_weight_grams?: number | null
          min_subtotal_cents?: number
          min_weight_grams?: number
          name: string
          position?: number
          price_cents: number
          service?: string
          tax_class?: string
          updated_at?: string
          zone_id: string
        }
        Update: {
          carrier?: string
          created_at?: string
          delivery_time_text?: string | null
          description?: string | null
          free_above_subtotal_cents?: number | null
          id?: string
          is_enabled?: boolean
          max_subtotal_cents?: number | null
          max_weight_grams?: number | null
          min_subtotal_cents?: number
          min_weight_grams?: number
          name?: string
          position?: number
          price_cents?: number
          service?: string
          tax_class?: string
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipping_rates_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "shipping_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_zones: {
        Row: {
          code: string
          country_codes: string[]
          created_at: string
          id: string
          is_enabled: boolean
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          code: string
          country_codes: string[]
          created_at?: string
          id?: string
          is_enabled?: boolean
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          code?: string
          country_codes?: string[]
          created_at?: string
          id?: string
          is_enabled?: boolean
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      shop_settings: {
        Row: {
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      staff_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          invited_by: string | null
          role: Database["public"]["Enums"]["staff_role"]
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
        }
        Relationships: []
      }
      staff_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_recovery_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      staff_users: {
        Row: {
          created_at: string
          created_by: string | null
          display_name: string | null
          email: string
          is_active: boolean
          last_login_at: string | null
          mfa_enforced: boolean
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email: string
          is_active?: boolean
          last_login_at?: string | null
          mfa_enforced?: boolean
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          email?: string
          is_active?: boolean
          last_login_at?: string | null
          mfa_enforced?: boolean
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_cancellation_requests: {
        Row: {
          confirmation_sent_at: string | null
          created_at: string
          customer_name: string
          desired_date: string | null
          email: string
          id: string
          ip_hash: string | null
          kind: string
          note: string | null
          reason: string | null
          received_at: string
          status: string
          subscription_ids: string[]
          subscription_number: string | null
          timing: string
          updated_at: string
        }
        Insert: {
          confirmation_sent_at?: string | null
          created_at?: string
          customer_name: string
          desired_date?: string | null
          email: string
          id?: string
          ip_hash?: string | null
          kind: string
          note?: string | null
          reason?: string | null
          received_at?: string
          status?: string
          subscription_ids?: string[]
          subscription_number?: string | null
          timing: string
          updated_at?: string
        }
        Update: {
          confirmation_sent_at?: string | null
          created_at?: string
          customer_name?: string
          desired_date?: string | null
          email?: string
          id?: string
          ip_hash?: string | null
          kind?: string
          note?: string | null
          reason?: string | null
          received_at?: string
          status?: string
          subscription_ids?: string[]
          subscription_number?: string | null
          timing?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          created_at: string
          data: Json
          id: number
          kind: string
          subscription_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          data?: Json
          id?: never
          kind: string
          subscription_id: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          created_at?: string
          data?: Json
          id?: never
          kind?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_orders: {
        Row: {
          created_at: string
          kind: string
          order_id: string
          subscription_id: string
        }
        Insert: {
          created_at?: string
          kind?: string
          order_id: string
          subscription_id: string
        }
        Update: {
          created_at?: string
          kind?: string
          order_id?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_orders_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_effective_at: string | null
          cancel_kind: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          customer_id: string
          discount_bp: number
          id: string
          interval_count: number
          interval_unit: string
          last_order_at: string | null
          last_payment_error: string | null
          last_payment_failed_at: string | null
          locked_price_cents: number | null
          next_order_at: string | null
          next_retry_at: string | null
          number: string
          past_due_since: string | null
          pause_reason: string | null
          paused_until: string | null
          payment_method_id: string | null
          pending_payment_intent_id: string | null
          price_change_effective_at: string | null
          price_notice_sent_at: string | null
          processing_started_at: string | null
          quantity: number
          reminder_sent_for: string | null
          retry_count: number
          shipping_address: Json | null
          skip_next: boolean
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          variant_id: string
        }
        Insert: {
          cancel_effective_at?: string | null
          cancel_kind?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_id: string
          discount_bp?: number
          id?: string
          interval_count?: number
          interval_unit?: string
          last_order_at?: string | null
          last_payment_error?: string | null
          last_payment_failed_at?: string | null
          locked_price_cents?: number | null
          next_order_at?: string | null
          next_retry_at?: string | null
          number?: string
          past_due_since?: string | null
          pause_reason?: string | null
          paused_until?: string | null
          payment_method_id?: string | null
          pending_payment_intent_id?: string | null
          price_change_effective_at?: string | null
          price_notice_sent_at?: string | null
          processing_started_at?: string | null
          quantity?: number
          reminder_sent_for?: string | null
          retry_count?: number
          shipping_address?: Json | null
          skip_next?: boolean
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          variant_id: string
        }
        Update: {
          cancel_effective_at?: string | null
          cancel_kind?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          customer_id?: string
          discount_bp?: number
          id?: string
          interval_count?: number
          interval_unit?: string
          last_order_at?: string | null
          last_payment_error?: string | null
          last_payment_failed_at?: string | null
          locked_price_cents?: number | null
          next_order_at?: string | null
          next_retry_at?: string | null
          number?: string
          past_due_since?: string | null
          pause_reason?: string | null
          paused_until?: string | null
          payment_method_id?: string | null
          pending_payment_intent_id?: string | null
          price_change_effective_at?: string | null
          price_notice_sent_at?: string | null
          processing_started_at?: string | null
          quantity?: number
          reminder_sent_for?: string | null
          retry_count?: number
          shipping_address?: Json | null
          skip_next?: boolean
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "customer_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_rates: {
        Row: {
          country_code: string
          id: string
          name: string
          rate_bp: number
          tax_class: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          country_code: string
          id?: string
          name: string
          rate_bp: number
          tax_class?: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          country_code?: string
          id?: string
          name?: string
          rate_bp?: number
          tax_class?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: []
      }
      tracking_events: {
        Row: {
          consent_state: string
          consent_vendors: string[]
          consent_version: string | null
          created_at: string
          currency: string | null
          event_id: string
          event_name: string
          id: number
          order_number_hash: string | null
          sent_to: Json
          source: string
          value_cents: number | null
        }
        Insert: {
          consent_state?: string
          consent_vendors?: string[]
          consent_version?: string | null
          created_at?: string
          currency?: string | null
          event_id: string
          event_name: string
          id?: never
          order_number_hash?: string | null
          sent_to?: Json
          source?: string
          value_cents?: number | null
        }
        Update: {
          consent_state?: string
          consent_vendors?: string[]
          consent_version?: string | null
          created_at?: string
          currency?: string | null
          event_id?: string
          event_name?: string
          id?: never
          order_number_hash?: string | null
          sent_to?: Json
          source?: string
          value_cents?: number | null
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          event_id: string
          event_type: string
          id: string
          order_id: string | null
          payload: Json
          processed_at: string | null
          processing_error: string | null
          provider: string
          received_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          id?: string
          order_id?: string | null
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          provider: string
          received_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          id?: string
          order_id?: string | null
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          provider?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawal_requests: {
        Row: {
          address: string | null
          confirmation_email_sent_at: string | null
          created_at: string
          customer_name: string
          email: string
          id: string
          ip_hash: string | null
          items_description: string
          message: string | null
          order_id: string | null
          order_number: string | null
          ordered_on: string | null
          received_on: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string
          customer_name: string
          email: string
          id?: string
          ip_hash?: string | null
          items_description: string
          message?: string | null
          order_id?: string | null
          order_number?: string | null
          ordered_on?: string | null
          received_on?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string
          customer_name?: string
          email?: string
          id?: string
          ip_hash?: string | null
          items_description?: string
          message?: string | null
          order_id?: string | null
          order_number?: string | null
          ordered_on?: string | null
          received_on?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawal_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_inventory: {
        Args: {
          p_actor?: string
          p_allow_negative?: boolean
          p_delta: number
          p_note?: string
          p_reason: Database["public"]["Enums"]["inventory_reason"]
          p_variant_id: string
        }
        Returns: {
          current_reserved: number
          movement_id: number
          new_on_hand: number
        }[]
      }
      admin_inventory_overview: {
        Args: never
        Returns: {
          allow_backorder: boolean
          available: number
          low_stock_threshold: number
          on_hand: number
          product_handle: string
          product_id: string
          product_kind: Database["public"]["Enums"]["product_kind"]
          product_status: Database["public"]["Enums"]["product_status"]
          product_title: string
          reserved: number
          sku: string
          track_inventory: boolean
          unit_count: number
          updated_at: string
          variant_active: boolean
          variant_id: string
          variant_title: string
        }[]
      }
      anonymize_customer: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      apply_inventory_movement: {
        Args: {
          p_actor?: string
          p_delta: number
          p_note?: string
          p_reason: Database["public"]["Enums"]["inventory_reason"]
          p_reference_id?: string
          p_reference_type?: string
          p_variant_id: string
        }
        Returns: undefined
      }
      available_quantity: { Args: { p_variant_id: string }; Returns: number }
      bundle_components_public: {
        Args: { p_bundle_variant_id: string; p_locale?: string }
        Returns: {
          component_variant_id: string
          deposit_cents_per_unit: number
          option_values: Json
          price_cents: number
          product_handle: string
          product_tags: string[]
          product_title: string
          quantity: number
          unit_count: number
          variant_title: string
        }[]
      }
      bundle_components_sum_cents: {
        Args: { p_bundle_variant_id: string }
        Returns: number
      }
      check_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window: string }
        Returns: boolean
      }
      claim_due_jobs: {
        Args: { p_kinds?: string[]; p_limit?: number; p_worker: string }
        Returns: {
          attempts: number
          created_at: string
          finished_at: string | null
          id: string
          idempotency_key: string | null
          kind: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          order_id: string | null
          payload: Json
          priority: number
          run_at: string
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_guest_orders_for: {
        Args: { p_customer_id: string }
        Returns: number
      }
      claim_jobs: {
        Args: { p_kinds?: string[]; p_limit?: number; p_worker: string }
        Returns: {
          attempts: number
          created_at: string
          finished_at: string | null
          id: string
          idempotency_key: string | null
          kind: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          order_id: string | null
          payload: Json
          priority: number
          run_at: string
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      commit_reservations: {
        Args: { p_checkout_session_id: string; p_order_id: string }
        Returns: undefined
      }
      complete_job: { Args: { p_id: string }; Returns: undefined }
      crm_assert_segment_sql: { Args: { p_where: string }; Returns: undefined }
      crm_segment_contact_ids: {
        Args: { p_params?: Json; p_where: string }
        Returns: string[]
      }
      crm_segment_count: {
        Args: { p_params?: Json; p_where: string }
        Returns: number
      }
      crm_segment_members: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_order?: string
          p_params?: Json
          p_where: string
        }
        Returns: string[]
      }
      current_customer_id: { Args: never; Returns: string }
      current_legal_version: {
        Args: {
          p_kind: Database["public"]["Enums"]["legal_document_kind"]
          p_locale?: string
        }
        Returns: {
          body_html: string
          change_note: string | null
          created_at: string
          created_by: string | null
          document_id: string
          effective_from: string | null
          id: string
          locale: string
          published_at: string | null
          published_by: string | null
          status: Database["public"]["Enums"]["publish_status"]
          title: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "legal_document_versions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_staff_role: {
        Args: never
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      enqueue_job: {
        Args: {
          p_idempotency_key?: string
          p_kind: string
          p_max_attempts?: number
          p_order_id?: string
          p_payload?: Json
          p_priority?: number
          p_run_at?: string
        }
        Returns: string
      }
      expire_reservations: { Args: never; Returns: number }
      fail_job: { Args: { p_error: string; p_id: string }; Returns: undefined }
      fail_job_with_backoff: {
        Args: { p_error: string; p_id: string }
        Returns: Database["public"]["Enums"]["job_status"]
      }
      invite_staff: {
        Args: {
          p_actor?: string
          p_email: string
          p_role: Database["public"]["Enums"]["staff_role"]
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_staff: {
        Args: { p_roles?: Database["public"]["Enums"]["staff_role"][] }
        Returns: boolean
      }
      link_auth_user_to_customer: {
        Args: {
          p_confirmed: boolean
          p_email: string
          p_meta?: Json
          p_user_id: string
        }
        Returns: string
      }
      lowest_price_last_30_days: {
        Args: { p_variant_id: string }
        Returns: number
      }
      merge_cart_into: {
        Args: { p_source: string; p_target: string }
        Returns: number
      }
      merge_customer_into: {
        Args: { p_source: string; p_target: string }
        Returns: undefined
      }
      next_order_number: { Args: never; Returns: string }
      next_subscription_number: { Args: never; Returns: string }
      random_token: { Args: { p_bytes?: number }; Returns: string }
      release_reservations: {
        Args: { p_checkout_session_id: string }
        Returns: undefined
      }
      requeue_stuck_jobs: { Args: never; Returns: number }
      reserve_stock: {
        Args: { p_checkout_session_id: string; p_items: Json; p_ttl?: string }
        Returns: undefined
      }
      retry_job: { Args: { p_id: string }; Returns: undefined }
      search_storefront: {
        Args: { p_limit?: number; p_locale?: string; p_query: string }
        Returns: {
          handle: string
          id: string
          kind: string
          rank: number
          subtitle: string
          title: string
        }[]
      }
      sha256_hex: { Args: { p_input: string }; Returns: string }
      slugify: { Args: { p_input: string }; Returns: string }
      subscription_apply: {
        Args: {
          p_actor_id?: string
          p_actor_type?: string
          p_event_data?: Json
          p_event_kind: string
          p_expected: Database["public"]["Enums"]["subscription_status"][]
          p_id: string
          p_patch: Json
        }
        Returns: {
          cancel_effective_at: string | null
          cancel_kind: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          created_at: string
          customer_id: string
          discount_bp: number
          id: string
          interval_count: number
          interval_unit: string
          last_order_at: string | null
          last_payment_error: string | null
          last_payment_failed_at: string | null
          locked_price_cents: number | null
          next_order_at: string | null
          next_retry_at: string | null
          number: string
          past_due_since: string | null
          pause_reason: string | null
          paused_until: string | null
          payment_method_id: string | null
          pending_payment_intent_id: string | null
          price_change_effective_at: string | null
          price_notice_sent_at: string | null
          processing_started_at: string | null
          quantity: number
          reminder_sent_for: string | null
          retry_count: number
          shipping_address: Json | null
          skip_next: boolean
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          variant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      subscription_claim_due: {
        Args: { p_limit?: number; p_now?: string }
        Returns: string[]
      }
      subscription_lock: { Args: { p_id: string }; Returns: boolean }
      subscription_release: { Args: { p_id: string }; Returns: undefined }
      variant_base_price_cents: {
        Args: { p_variant_id: string }
        Returns: number
      }
      variant_deposit_cents: { Args: { p_variant_id: string }; Returns: number }
    }
    Enums: {
      b2b_status: "none" | "requested" | "approved" | "rejected"
      campaign_status:
        | "draft"
        | "scheduled"
        | "sending"
        | "sent"
        | "cancelled"
        | "failed"
      cart_status: "active" | "converted" | "abandoned" | "merged"
      checkout_status:
        | "open"
        | "processing"
        | "completed"
        | "expired"
        | "cancelled"
        | "failed"
      compare_at_kind:
        | "none"
        | "former_price"
        | "components_sum"
        | "quantity_reference"
      customer_type: "b2c" | "b2b"
      discount_kind: "percentage" | "fixed_amount" | "free_shipping"
      email_category: "transactional" | "marketing" | "auth" | "internal"
      email_status:
        | "queued"
        | "sent"
        | "delivered"
        | "bounced"
        | "complained"
        | "failed"
        | "suppressed"
        | "blocked_allowlist"
      fulfillment_status: "unfulfilled" | "partial" | "fulfilled"
      inventory_reason:
        | "initial"
        | "purchase"
        | "sale"
        | "refund_restock"
        | "correction"
        | "damaged"
        | "import"
        | "reservation_commit"
      invoice_status:
        | "none"
        | "queued"
        | "draft"
        | "finalized"
        | "sent"
        | "failed"
      job_status:
        | "queued"
        | "running"
        | "succeeded"
        | "failed"
        | "dead"
        | "cancelled"
      lead_status: "new" | "contacted" | "qualified" | "won" | "lost"
      legal_document_kind:
        | "impressum"
        | "agb"
        | "widerruf"
        | "datenschutz"
        | "versand"
      newsletter_status:
        | "pending"
        | "subscribed"
        | "unsubscribed"
        | "bounced"
        | "complained"
      order_status:
        | "pending"
        | "paid"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "refunded"
        | "partially_refunded"
      payment_status:
        | "unpaid"
        | "authorized"
        | "paid"
        | "partially_refunded"
        | "refunded"
        | "failed"
      product_kind: "simple" | "bundle"
      product_status: "draft" | "active" | "archived"
      publish_status: "draft" | "published" | "archived"
      refund_status: "pending" | "succeeded" | "failed" | "cancelled"
      reservation_status: "active" | "committed" | "released" | "expired"
      review_status: "pending" | "approved" | "rejected"
      shipment_status:
        | "label_created"
        | "shipped"
        | "in_transit"
        | "delivered"
        | "returned"
        | "cancelled"
        | "manual"
      staff_role: "owner" | "admin" | "support" | "fulfillment"
      subscription_status:
        | "draft"
        | "active"
        | "paused"
        | "past_due"
        | "cancelled"
      unit_measure: "l" | "kg" | "piece"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      b2b_status: ["none", "requested", "approved", "rejected"],
      campaign_status: [
        "draft",
        "scheduled",
        "sending",
        "sent",
        "cancelled",
        "failed",
      ],
      cart_status: ["active", "converted", "abandoned", "merged"],
      checkout_status: [
        "open",
        "processing",
        "completed",
        "expired",
        "cancelled",
        "failed",
      ],
      compare_at_kind: [
        "none",
        "former_price",
        "components_sum",
        "quantity_reference",
      ],
      customer_type: ["b2c", "b2b"],
      discount_kind: ["percentage", "fixed_amount", "free_shipping"],
      email_category: ["transactional", "marketing", "auth", "internal"],
      email_status: [
        "queued",
        "sent",
        "delivered",
        "bounced",
        "complained",
        "failed",
        "suppressed",
        "blocked_allowlist",
      ],
      fulfillment_status: ["unfulfilled", "partial", "fulfilled"],
      inventory_reason: [
        "initial",
        "purchase",
        "sale",
        "refund_restock",
        "correction",
        "damaged",
        "import",
        "reservation_commit",
      ],
      invoice_status: [
        "none",
        "queued",
        "draft",
        "finalized",
        "sent",
        "failed",
      ],
      job_status: [
        "queued",
        "running",
        "succeeded",
        "failed",
        "dead",
        "cancelled",
      ],
      lead_status: ["new", "contacted", "qualified", "won", "lost"],
      legal_document_kind: [
        "impressum",
        "agb",
        "widerruf",
        "datenschutz",
        "versand",
      ],
      newsletter_status: [
        "pending",
        "subscribed",
        "unsubscribed",
        "bounced",
        "complained",
      ],
      order_status: [
        "pending",
        "paid",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
        "partially_refunded",
      ],
      payment_status: [
        "unpaid",
        "authorized",
        "paid",
        "partially_refunded",
        "refunded",
        "failed",
      ],
      product_kind: ["simple", "bundle"],
      product_status: ["draft", "active", "archived"],
      publish_status: ["draft", "published", "archived"],
      refund_status: ["pending", "succeeded", "failed", "cancelled"],
      reservation_status: ["active", "committed", "released", "expired"],
      review_status: ["pending", "approved", "rejected"],
      shipment_status: [
        "label_created",
        "shipped",
        "in_transit",
        "delivered",
        "returned",
        "cancelled",
        "manual",
      ],
      staff_role: ["owner", "admin", "support", "fulfillment"],
      subscription_status: [
        "draft",
        "active",
        "paused",
        "past_due",
        "cancelled",
      ],
      unit_measure: ["l", "kg", "piece"],
    },
  },
} as const
