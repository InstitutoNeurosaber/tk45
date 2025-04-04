import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, Building, Briefcase, Camera, Save, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { userService } from '../services/userService';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Função para upload de arquivos
const uploadFile = async (path: string, file: File): Promise<string> => {
  const storage = getStorage();
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  return getDownloadURL(snapshot.ref);
};

// Esquema de validação com Zod
const profileSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  profile: z.object({
    displayName: z.string().optional(),
    phoneNumber: z.string().optional(),
    department: z.string().optional(),
    position: z.string().optional()
  }).optional()
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, userData, fetchUserData } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: userData?.name || '',
      profile: {
        displayName: userData?.profile?.displayName || '',
        phoneNumber: userData?.profile?.phoneNumber || '',
        department: userData?.profile?.department || '',
        position: userData?.profile?.position || ''
      }
    }
  });

  // Atualizar formulário quando dados do usuário mudarem
  useEffect(() => {
    if (userData) {
      reset({
        name: userData.name,
        profile: {
          displayName: userData.profile?.displayName || '',
          phoneNumber: userData.profile?.phoneNumber || '',
          department: userData.profile?.department || '',
          position: userData.profile?.position || ''
        }
      });
    }
  }, [userData, reset]);

  // Processar upload de foto
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Função para atualizar os dados do usuário no estado
  const refreshUserData = async () => {
    if (user) {
      await fetchUserData(user.uid);
    }
  };

  // Enviar formulário
  const onSubmit = async (data: ProfileFormData) => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Atualizar dados do perfil
      await userService.updateUserData(user.uid, {
        name: data.name,
        profile: data.profile
      });
      
      // Upload da foto se houver
      if (photoFile) {
        const photoURL = await uploadFile(`users/${user.uid}/photo`, photoFile);
        await userService.updateUserData(user.uid, {
          profile: {
            ...data.profile,
            photoURL
          }
        });
      }
      
      // Atualizar dados do usuário no estado
      await refreshUserData();
      
      setSuccess('Perfil atualizado com sucesso!');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Erro ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  if (!user || !userData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Botão de Voltar */}
      <button
        onClick={() => navigate('/')}
        className="fixed top-4 left-4 z-50 flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </button>

      <div className="max-w-3xl mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          {/* Cabeçalho */}
          <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Meu Perfil
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Informações pessoais e configurações da sua conta
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-5 space-y-8">
            {/* Avatar e upload de foto */}
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative rounded-full overflow-hidden h-24 w-24 bg-gray-100 dark:bg-gray-700 flex items-center justify-center border border-gray-200 dark:border-gray-600">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                ) : userData.profile?.photoURL ? (
                  <img src={userData.profile.photoURL} alt={userData.name} className="h-full w-full object-cover" />
                ) : (
                  <User className="h-12 w-12 text-gray-400" />
                )}
              </div>
              
              <div className="flex flex-col space-y-3">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Foto de Perfil</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Recomendamos uma imagem de pelo menos 400x400 pixels
                </p>
                <div>
                  <label className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer">
                    <Camera className="h-4 w-4 mr-2" />
                    Alterar Foto
                    <input
                      type="file"
                      className="sr-only"
                      accept="image/*"
                      onChange={handlePhotoChange}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Informações Pessoais
              </h3>
              
              <div className="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-6">
                {/* Nome */}
                <div className="sm:col-span-3">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nome Completo
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="name"
                      {...register('name')}
                      className="block w-full pl-10 py-2 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>
                  )}
                </div>

                {/* Nome de Exibição */}
                <div className="sm:col-span-3">
                  <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nome de Exibição
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="displayName"
                      {...register('profile.displayName')}
                      className="block w-full pl-10 py-2 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>

                {/* Email (somente leitura) */}
                <div className="sm:col-span-3">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Email
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      id="email"
                      value={userData.email}
                      readOnly
                      className="block w-full pl-10 py-2 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 cursor-not-allowed sm:text-sm"
                    />
                  </div>
                </div>

                {/* Telefone */}
                <div className="sm:col-span-3">
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Telefone
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      id="phoneNumber"
                      {...register('profile.phoneNumber')}
                      className="block w-full pl-10 py-2 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>

                {/* Departamento */}
                <div className="sm:col-span-3">
                  <label htmlFor="department" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Departamento
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Building className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="department"
                      {...register('profile.department')}
                      className="block w-full pl-10 py-2 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>

                {/* Cargo */}
                <div className="sm:col-span-3">
                  <label htmlFor="position" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Cargo
                  </label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Briefcase className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="position"
                      {...register('profile.position')}
                      className="block w-full pl-10 py-2 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Mensagens de erro ou sucesso */}
            {error && (
              <div className="px-4 py-3 rounded-md bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            {success && (
              <div className="px-4 py-3 rounded-md bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                <div className="flex">
                  <Save className="h-5 w-5 mr-2 flex-shrink-0" />
                  <span>{success}</span>
                </div>
              </div>
            )}

            {/* Botões */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-5 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => navigate('/')}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center">
                    <span className="animate-spin mr-2 h-4 w-4 border-2 border-white border-l-transparent rounded-full"></span>
                    Salvando...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Alterações
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 