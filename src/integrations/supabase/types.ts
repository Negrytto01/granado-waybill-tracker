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
          observacoes_armazenagem: string | null
          pausas: Json | null
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
          observacoes_armazenagem?: string | null
          pausas?: Json | null
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
          observacoes_armazenagem?: string | null
          pausas?: Json | null
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
      atividades_usuarios: {
        Row: {
          acao: string
          data_criacao: string
          detalhes: string | null
          id: string
          user_id: string
          usuario_nome: string
        }
        Insert: {
          acao: string
          data_criacao?: string
          detalhes?: string | null
          id?: string
          user_id: string
          usuario_nome: string
        }
        Update: {
          acao?: string
          data_criacao?: string
          detalhes?: string | null
          id?: string
          user_id?: string
          usuario_nome?: string
        }
        Relationships: []
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
      fornecedores_nao_vieram: {
        Row: {
          avisou_antecedencia: boolean
          data_criacao: string
          fornecedor: string
          id: string
          motivo: string
          multa: number
          observacoes: string | null
          recebimento_id: string | null
          usuario: string | null
        }
        Insert: {
          avisou_antecedencia?: boolean
          data_criacao?: string
          fornecedor: string
          id?: string
          motivo?: string
          multa?: number
          observacoes?: string | null
          recebimento_id?: string | null
          usuario?: string | null
        }
        Update: {
          avisou_antecedencia?: boolean
          data_criacao?: string
          fornecedor?: string
          id?: string
          motivo?: string
          multa?: number
          observacoes?: string | null
          recebimento_id?: string | null
          usuario?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_nao_vieram_recebimento_id_fkey"
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
      mensagens_globais: {
        Row: {
          data_criacao: string
          destinatarios: Json
          enviado_por: string
          enviado_por_user_id: string
          id: string
          lida_por: Json
          mensagem: string
        }
        Insert: {
          data_criacao?: string
          destinatarios?: Json
          enviado_por: string
          enviado_por_user_id: string
          id?: string
          lida_por?: Json
          mensagem: string
        }
        Update: {
          data_criacao?: string
          destinatarios?: Json
          enviado_por?: string
          enviado_por_user_id?: string
          id?: string
          lida_por?: Json
          mensagem?: string
        }
        Relationships: []
      }
      motoristas: {
        Row: {
          data_criacao: string
          id: string
          nome: string
        }
        Insert: {
          data_criacao?: string
          id?: string
          nome: string
        }
        Update: {
          data_criacao?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      ocorrencias_armazenagem: {
        Row: {
          data_criacao: string
          fornecedor: string
          id: string
          ocorrencia: string
          registrado_por: string | null
        }
        Insert: {
          data_criacao?: string
          fornecedor: string
          id?: string
          ocorrencia: string
          registrado_por?: string | null
        }
        Update: {
          data_criacao?: string
          fornecedor?: string
          id?: string
          ocorrencia?: string
          registrado_por?: string | null
        }
        Relationships: []
      }
      ocorrencias_tipos: {
        Row: {
          data_criacao: string
          id: string
          nome: string
        }
        Insert: {
          data_criacao?: string
          id?: string
          nome: string
        }
        Update: {
          data_criacao?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      portaria_registros: {
        Row: {
          data_criacao: string
          id: string
          km_chegada: string | null
          motorista_id: string | null
          motorista_nome: string | null
          observacoes_problema: string | null
          registrado_por: string | null
          tem_problema: boolean
          veiculo_id: string | null
          veiculo_nome: string | null
          veiculo_placa: string | null
        }
        Insert: {
          data_criacao?: string
          id?: string
          km_chegada?: string | null
          motorista_id?: string | null
          motorista_nome?: string | null
          observacoes_problema?: string | null
          registrado_por?: string | null
          tem_problema?: boolean
          veiculo_id?: string | null
          veiculo_nome?: string | null
          veiculo_placa?: string | null
        }
        Update: {
          data_criacao?: string
          id?: string
          km_chegada?: string | null
          motorista_id?: string | null
          motorista_nome?: string | null
          observacoes_problema?: string | null
          registrado_por?: string | null
          tem_problema?: boolean
          veiculo_id?: string | null
          veiculo_nome?: string | null
          veiculo_placa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portaria_registros_motorista_id_fkey"
            columns: ["motorista_id"]
            isOneToOne: false
            referencedRelation: "motoristas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portaria_registros_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
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
          is_encaixe: boolean
          is_marketing: boolean
          is_pallet: boolean
          is_retirada: boolean
          motorista: string | null
          nfd_numero: string | null
          numero_nf: string
          observacoes: string | null
          pallets_descarregados: number | null
          placa: string | null
          quantidade_itens: number | null
          quantidade_volumes: number | null
          status: Database["public"]["Enums"]["recebimento_status"]
          tipo_descarga: string | null
          toneladas: number | null
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
          is_encaixe?: boolean
          is_marketing?: boolean
          is_pallet?: boolean
          is_retirada?: boolean
          motorista?: string | null
          nfd_numero?: string | null
          numero_nf: string
          observacoes?: string | null
          pallets_descarregados?: number | null
          placa?: string | null
          quantidade_itens?: number | null
          quantidade_volumes?: number | null
          status?: Database["public"]["Enums"]["recebimento_status"]
          tipo_descarga?: string | null
          toneladas?: number | null
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
          is_encaixe?: boolean
          is_marketing?: boolean
          is_pallet?: boolean
          is_retirada?: boolean
          motorista?: string | null
          nfd_numero?: string | null
          numero_nf?: string
          observacoes?: string | null
          pallets_descarregados?: number | null
          placa?: string | null
          quantidade_itens?: number | null
          quantidade_volumes?: number | null
          status?: Database["public"]["Enums"]["recebimento_status"]
          tipo_descarga?: string | null
          toneladas?: number | null
          transportadora?: string | null
          usuario_responsavel?: string | null
          valor_cobrado?: number | null
          xml_nota?: string | null
        }
        Relationships: []
      }
      relatorios_mensais: {
        Row: {
          data_criacao: string
          fornecedor: string
          id: string
          mes_referencia: string
          total_descargas: number
          total_volumes: number
        }
        Insert: {
          data_criacao?: string
          fornecedor: string
          id?: string
          mes_referencia: string
          total_descargas?: number
          total_volumes?: number
        }
        Update: {
          data_criacao?: string
          fornecedor?: string
          id?: string
          mes_referencia?: string
          total_descargas?: number
          total_volumes?: number
        }
        Relationships: []
      }
      solicitacoes_compras: {
        Row: {
          data_aprovacao_compras: string | null
          data_criacao: string
          data_resposta: string | null
          data_sugerida: string | null
          fornecedor: string
          horario_sugerido: string | null
          id: string
          nf_entries: Json | null
          observacoes: string | null
          respondido_por: string | null
          resposta_observacoes: string | null
          solicitado_por: string
          solicitado_por_user_id: string
          status: string
          volumes: number | null
        }
        Insert: {
          data_aprovacao_compras?: string | null
          data_criacao?: string
          data_resposta?: string | null
          data_sugerida?: string | null
          fornecedor: string
          horario_sugerido?: string | null
          id?: string
          nf_entries?: Json | null
          observacoes?: string | null
          respondido_por?: string | null
          resposta_observacoes?: string | null
          solicitado_por: string
          solicitado_por_user_id: string
          status?: string
          volumes?: number | null
        }
        Update: {
          data_aprovacao_compras?: string | null
          data_criacao?: string
          data_resposta?: string | null
          data_sugerida?: string | null
          fornecedor?: string
          horario_sugerido?: string | null
          id?: string
          nf_entries?: Json | null
          observacoes?: string | null
          respondido_por?: string | null
          resposta_observacoes?: string | null
          solicitado_por?: string
          solicitado_por_user_id?: string
          status?: string
          volumes?: number | null
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          ativo: boolean
          cargo: Database["public"]["Enums"]["cargo_tipo"]
          data_criacao: string
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          cargo?: Database["public"]["Enums"]["cargo_tipo"]
          data_criacao?: string
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          ativo?: boolean
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
          valor_multa: number
          valor_por_caixa: number
          valor_por_pallet: number
          valor_por_tonelada: number
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          id?: string
          valor_multa?: number
          valor_por_caixa?: number
          valor_por_pallet?: number
          valor_por_tonelada?: number
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          id?: string
          valor_multa?: number
          valor_por_caixa?: number
          valor_por_pallet?: number
          valor_por_tonelada?: number
        }
        Relationships: []
      }
      veiculos: {
        Row: {
          data_criacao: string
          id: string
          modelo: string | null
          nome: string
          placa: string
        }
        Insert: {
          data_criacao?: string
          id?: string
          modelo?: string | null
          nome: string
          placa: string
        }
        Update: {
          data_criacao?: string
          id?: string
          modelo?: string | null
          nome?: string
          placa?: string
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
        | "PAUSADO"
      cargo_tipo:
        | "Administrador"
        | "Recebimento"
        | "Conferente"
        | "Estoque"
        | "Fiscal"
        | "Compras"
        | "Financeiro"
        | "Faturamento"
        | "Master"
        | "Agendamento/Conferente"
        | "Compra"
        | "Portaria"
      recebimento_status:
        | "AGENDADO"
        | "CHEGOU"
        | "EM DESCARGA"
        | "DESCARGA FINALIZADA"
        | "AGUARDANDO ARMAZENAGEM"
        | "FINALIZADO"
        | "ACOPLADO"
        | "DESACOPLADO"
        | "AGUARDANDO DESACOPLAGEM"
        | "NAO_VEIO"
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
        "PAUSADO",
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
        "Master",
        "Agendamento/Conferente",
        "Compra",
        "Portaria",
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
        "AGUARDANDO DESACOPLAGEM",
        "NAO_VEIO",
      ],
    },
  },
} as const
