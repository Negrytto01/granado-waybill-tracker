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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      armazenagem: {
        Row: {
          data_criacao: string
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          quantidade_itens: number | null
          quantidade_volumes: number | null
          recebimento_id: string
          status: Database["public"]["Enums"]["armazenagem_status"]
          usuario_responsavel: string | null
        }
        Insert: {
          data_criacao?: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          quantidade_itens?: number | null
          quantidade_volumes?: number | null
          recebimento_id: string
          status?: Database["public"]["Enums"]["armazenagem_status"]
          usuario_responsavel?: string | null
        }
        Update: {
          data_criacao?: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          quantidade_itens?: number | null
          quantidade_volumes?: number | null
          recebimento_id?: string
          status?: Database["public"]["Enums"]["armazenagem_status"]
          usuario_responsavel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "armazenagem_recebimento_id_fkey"
            columns: ["recebimento_id"]
            isOneToOne: false
            referencedRelation: "recebimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_permissoes: {
        Row: {
          ativo: boolean
          cargo: string
          data_criacao: string
          id: string
          pagina: string
        }
        Insert: {
          ativo?: boolean
          cargo: string
          data_criacao?: string
          id?: string
          pagina: string
        }
        Update: {
          ativo?: boolean
          cargo?: string
          data_criacao?: string
          id?: string
          pagina?: string
        }
        Relationships: []
      }
      etiquetas_pallet: {
        Row: {
          data_criacao: string
          descricao: string
          id: string
          peso: string | null
          quantidade_caixa: number
          usuario: string
          validade: string | null
        }
        Insert: {
          data_criacao?: string
          descricao: string
          id?: string
          peso?: string | null
          quantidade_caixa?: number
          usuario: string
          validade?: string | null
        }
        Update: {
          data_criacao?: string
          descricao?: string
          id?: string
          peso?: string | null
          quantidade_caixa?: number
          usuario?: string
          validade?: string | null
        }
        Relationships: []
      }
      fluxo_financeiro: {
        Row: {
          criado_por: string | null
          data_criacao: string
          descricao: string
          id: string
          mes_referencia: string
          recebimento_id: string | null
          tipo: string
          valor: number
        }
        Insert: {
          criado_por?: string | null
          data_criacao?: string
          descricao: string
          id?: string
          mes_referencia?: string
          recebimento_id?: string | null
          tipo: string
          valor?: number
        }
        Update: {
          criado_por?: string | null
          data_criacao?: string
          descricao?: string
          id?: string
          mes_referencia?: string
          recebimento_id?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fluxo_financeiro_recebimento_id_fkey"
            columns: ["recebimento_id"]
            isOneToOne: false
            referencedRelation: "recebimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores_urgencia: {
        Row: {
          contagem_urgencias: number
          data_criacao: string
          id: string
          nome_fornecedor: string
          observacoes: string | null
          ultima_urgencia: string
        }
        Insert: {
          contagem_urgencias?: number
          data_criacao?: string
          id?: string
          nome_fornecedor: string
          observacoes?: string | null
          ultima_urgencia?: string
        }
        Update: {
          contagem_urgencias?: number
          data_criacao?: string
          id?: string
          nome_fornecedor?: string
          observacoes?: string | null
          ultima_urgencia?: string
        }
        Relationships: []
      }
      recebimentos: {
        Row: {
          caixas_batidas: number | null
          cnpj: string | null
          data_criacao: string
          data_prevista: string | null
          fornecedor: string
          hora_acoplagem: string | null
          hora_chegada: string | null
          hora_desacoplagem: string | null
          hora_fim_descarga: string | null
          hora_inicio_descarga: string | null
          horario_agenda: string | null
          id: string
          motorista: string | null
          numero_nf: string
          pallets_descarregados: number | null
          placa: string | null
          quantidade_itens: number | null
          quantidade_volumes: number | null
          status: Database["public"]["Enums"]["recebimento_status"]
          transportadora: string | null
          usuario_responsavel: string | null
          valor_cobrado: number | null
          xml_nota: string | null
        }
        Insert: {
          caixas_batidas?: number | null
          cnpj?: string | null
          data_criacao?: string
          data_prevista?: string | null
          fornecedor: string
          hora_acoplagem?: string | null
          hora_chegada?: string | null
          hora_desacoplagem?: string | null
          hora_fim_descarga?: string | null
          hora_inicio_descarga?: string | null
          horario_agenda?: string | null
          id?: string
          motorista?: string | null
          numero_nf: string
          pallets_descarregados?: number | null
          placa?: string | null
          quantidade_itens?: number | null
          quantidade_volumes?: number | null
          status?: Database["public"]["Enums"]["recebimento_status"]
          transportadora?: string | null
          usuario_responsavel?: string | null
          valor_cobrado?: number | null
          xml_nota?: string | null
        }
        Update: {
          caixas_batidas?: number | null
          cnpj?: string | null
          data_criacao?: string
          data_prevista?: string | null
          fornecedor?: string
          hora_acoplagem?: string | null
          hora_chegada?: string | null
          hora_desacoplagem?: string | null
          hora_fim_descarga?: string | null
          hora_inicio_descarga?: string | null
          horario_agenda?: string | null
          id?: string
          motorista?: string | null
          numero_nf?: string
          pallets_descarregados?: number | null
          placa?: string | null
          quantidade_itens?: number | null
          quantidade_volumes?: number | null
          status?: Database["public"]["Enums"]["recebimento_status"]
          transportadora?: string | null
          usuario_responsavel?: string | null
          valor_cobrado?: number | null
          xml_nota?: string | null
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          cargo: Database["public"]["Enums"]["cargo_tipo"]
          data_criacao: string
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          cargo?: Database["public"]["Enums"]["cargo_tipo"]
          data_criacao?: string
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          cargo?: Database["public"]["Enums"]["cargo_tipo"]
          data_criacao?: string
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: []
      }
      valores_descarga: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          id: string
          valor_por_caixa: number
          valor_por_pallet: number
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          id?: string
          valor_por_caixa?: number
          valor_por_pallet?: number
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          id?: string
          valor_por_caixa?: number
          valor_por_pallet?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      armazenagem_status:
        | "AGUARDANDO ARMAZENAGEM"
        | "EM ARMAZENAGEM"
        | "FINALIZADO"
      cargo_tipo:
        | "Administrador"
        | "Recebimento"
        | "Conferente"
        | "Estoque"
        | "Fiscal"
        | "Compras"
        | "Financeiro"
        | "Faturamento"
      recebimento_status:
        | "AGENDADO"
        | "CHEGOU"
        | "EM DESCARGA"
        | "DESCARGA FINALIZADA"
        | "AGUARDANDO ARMAZENAGEM"
        | "FINALIZADO"
        | "ACOPLADO"
        | "DESACOPLADO"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      armazenagem_status: [
        "AGUARDANDO ARMAZENAGEM",
        "EM ARMAZENAGEM",
        "FINALIZADO",
      ],
      cargo_tipo: [
        "Administrador",
        "Recebimento",
        "Conferente",
        "Estoque",
        "Fiscal",
        "Compras",
        "Financeiro",
        "Faturamento",
      ],
      recebimento_status: [
        "AGENDADO",
        "CHEGOU",
        "EM DESCARGA",
        "DESCARGA FINALIZADA",
        "AGUARDANDO ARMAZENAGEM",
        "FINALIZADO",
        "ACOPLADO",
        "DESACOPLADO",
      ],
    },
  },
} as const
